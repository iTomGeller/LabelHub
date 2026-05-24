package com.labelhub.task.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class DeepSeekService {
    private static final Logger log = LoggerFactory.getLogger(DeepSeekService.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String model;
    private final boolean enabled;
    private final AgentMetrics agentMetrics;

    private final Counter callsSuccess;
    private final Counter callsFallback;
    private final Counter callsError;
    private final Timer callLatency;
    private final Counter tokensUsed;
    private final AtomicLong totalCalls = new AtomicLong(0);
    private final AtomicLong totalLatencyMs = new AtomicLong(0);

    public DeepSeekService(
            @Value("${deepseek.api-key:}") String apiKey,
            @Value("${deepseek.base-url:https://api.deepseek.com}") String baseUrl,
            @Value("${deepseek.model:deepseek-chat}") String model,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry,
            AgentMetrics agentMetrics
    ) {
        this.model = model;
        this.objectMapper = objectMapper;
        this.enabled = apiKey != null && !apiKey.isBlank();
        this.agentMetrics = agentMetrics;

        this.callsSuccess = Counter.builder("deepseek.calls")
                .tag("outcome", "success").register(meterRegistry);
        this.callsFallback = Counter.builder("deepseek.calls")
                .tag("outcome", "fallback").register(meterRegistry);
        this.callsError = Counter.builder("deepseek.calls")
                .tag("outcome", "error").register(meterRegistry);
        this.callLatency = Timer.builder("deepseek.latency")
                .description("DeepSeek API call latency")
                .register(meterRegistry);
        this.tokensUsed = Counter.builder("deepseek.tokens")
                .description("Total tokens consumed")
                .register(meterRegistry);

        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", "application/json")
                .build();

        log.info("DeepSeek service initialized: enabled={}, model={}, baseUrl={}", enabled, model, baseUrl);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public record GenerateTaskConfigRequest(
            String taskId,
            String taskName,
            String instruction,
            List<Map<String, Object>> sampleData,
            String ragContext
    ) {
        public GenerateTaskConfigRequest(String taskId, String taskName, String instruction, List<Map<String, Object>> sampleData) {
            this(taskId, taskName, instruction, sampleData, null);
        }
    }

    public record GenerateTaskConfigResponse(
            String taskId,
            List<Map<String, Object>> schemaComponents,
            List<Map<String, Object>> rubricRules,
            List<String> rubricDimensions,
            Map<String, Object> assignmentPolicy,
            Map<String, Object> agentPolicy,
            String rationale
    ) {}

    public long getTotalCalls() { return totalCalls.get(); }

    public String getAverageLatency() {
        long calls = totalCalls.get();
        if (calls == 0) return "N/A";
        return (totalLatencyMs.get() / calls) + "ms";
    }

    public GenerateTaskConfigResponse generateTaskConfig(GenerateTaskConfigRequest request) {
        if (!enabled) {
            log.warn("DeepSeek API key not configured, returning fallback config");
            callsFallback.increment();
            totalCalls.incrementAndGet();
            agentMetrics.recordAgentCall(AgentMetrics.AGENT_CONFIG_GEN, "fallback", 0);
            return fallbackConfig(request);
        }

        String samplePreview;
        try {
            var subset = request.sampleData().stream().limit(3).toList();
            samplePreview = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(subset);
        } catch (JsonProcessingException e) {
            samplePreview = "无法序列化样例数据";
        }

        String baseSystemPrompt = """
                你是 LabelHub 的任务配置 AI 助手。根据用户的任务描述和样例数据，生成完整的标注任务配置。
                
                你必须返回一个合法 JSON 对象（不要用 markdown code block），包含以下字段：
                - schemaComponents: 标注模板组件数组，每个组件包含 {id, type, label, dataPath, required, props, validation}
                  - type 必须是以下之一: shortText, longText, singleChoice, multiChoice, tagSelect, richText, fileUpload, jsonEditor, llmInteraction, showItem
                  - 至少包含 showItem（展示原始数据）、singleChoice/multiChoice（分类）、longText（理由）
                - rubricRules: 质检规则数组，每条包含 {ruleId, description, severity, appliesTo, positiveExamples, negativeExamples, allowAgentAutoPass}
                  - severity: low/medium/high/critical
                - rubricDimensions: 评分维度数组，至少4个（如 ["相关性","准确性","格式合规","安全性"]）
                - assignmentPolicy: {mode: "auto_claim", replicasPerItem: 1, deadlineHours: 24, quotaPerLabeler: 50}
                - agentPolicy: {precheckEnabled: true, confidenceThreshold: 0.8, modelPreference: "deepseek-chat", promptTemplateVersionId: "auto_v1"}
                - rationale: 一段中文说明，解释你为什么这样配置""";

        String systemPrompt = (request.ragContext() != null && !request.ragContext().isBlank())
                ? baseSystemPrompt + "\n\n以下是平台的专业知识约束，你生成的配置必须严格遵守：\n" + request.ragContext()
                : baseSystemPrompt;

        String userPrompt = """
                任务名称：%s
                
                任务说明：%s
                
                样例数据（前3条）：
                %s
                
                请根据以上信息生成完整的标注任务配置。""".formatted(
                request.taskName().isBlank() ? "未命名任务" : request.taskName(),
                request.instruction().isBlank() ? "根据样例数据推断标注需求" : request.instruction(),
                samplePreview
        );

        long startMs = System.currentTimeMillis();
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    ),
                    "temperature", 0.3,
                    "max_tokens", 4000,
                    "response_format", Map.of("type", "json_object")
            );

            String responseBody = webClient.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(30))
                    .block();

            long elapsed = System.currentTimeMillis() - startMs;
            callLatency.record(Duration.ofMillis(elapsed));
            totalLatencyMs.addAndGet(elapsed);
            totalCalls.incrementAndGet();

            JsonNode root = objectMapper.readTree(responseBody);

            JsonNode usage = root.path("usage");
            if (!usage.isMissingNode()) {
                int total = usage.path("total_tokens").asInt(0);
                if (total > 0) tokensUsed.increment(total);
            }

            String content = root.path("choices").path(0).path("message").path("content").asText("{}");
            JsonNode result = objectMapper.readTree(content);

            callsSuccess.increment();
            agentMetrics.recordAgentCall(AgentMetrics.AGENT_CONFIG_GEN, "success", elapsed * 1_000_000L);
            agentMetrics.recordConfidence(AgentMetrics.AGENT_CONFIG_GEN, 0.85);
            agentMetrics.recordAgentChain(AgentMetrics.AGENT_CONFIG_GEN, AgentMetrics.AGENT_SCHEMA_RISK);
            return new GenerateTaskConfigResponse(
                    request.taskId(),
                    parseListOfMaps(result, "schemaComponents"),
                    parseListOfMaps(result, "rubricRules"),
                    parseStringList(result, "rubricDimensions"),
                    parseMap(result, "assignmentPolicy"),
                    parseMap(result, "agentPolicy"),
                    result.path("rationale").asText("已生成配置")
            );
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - startMs;
            callLatency.record(Duration.ofMillis(elapsed));
            totalLatencyMs.addAndGet(elapsed);
            totalCalls.incrementAndGet();
            callsError.increment();
            agentMetrics.recordAgentCall(AgentMetrics.AGENT_CONFIG_GEN, "error", elapsed * 1_000_000L);
            agentMetrics.recordCascadeFailure(AgentMetrics.AGENT_CONFIG_GEN);

            log.error("DeepSeek API call failed: {}", e.getMessage(), e);
            var fallback = fallbackConfig(request);
            return new GenerateTaskConfigResponse(
                    fallback.taskId(),
                    fallback.schemaComponents(),
                    fallback.rubricRules(),
                    fallback.rubricDimensions(),
                    fallback.assignmentPolicy(),
                    fallback.agentPolicy(),
                    "DeepSeek 调用失败 (" + e.getMessage() + ")，使用本地兜底配置。"
            );
        }
    }

    private GenerateTaskConfigResponse fallbackConfig(GenerateTaskConfigRequest request) {
        List<Map<String, Object>> components = List.of(
                Map.of("id", "raw_display", "type", "showItem", "label", "原始数据",
                        "dataPath", "$.raw", "required", false, "props", Map.of(), "validation", List.of()),
                Map.of("id", "category", "type", "singleChoice", "label", "分类标签",
                        "dataPath", "$.annotation.category", "required", true,
                        "props", Map.of("options", List.of("类别A", "类别B", "类别C", "其他")),
                        "validation", List.of(Map.of("type", "required", "value", true, "message", "请选择分类"))),
                Map.of("id", "reason", "type", "longText", "label", "判断理由",
                        "dataPath", "$.annotation.reason", "required", true,
                        "props", Map.of("placeholder", "请说明判断依据"),
                        "validation", List.of(
                                Map.of("type", "required", "value", true, "message", "请填写理由"),
                                Map.of("type", "minLength", "value", 5, "message", "至少5个字")))
        );

        List<Map<String, Object>> rules = List.of(
                Map.of("ruleId", "R1", "description", "标注结论必须有原文依据", "severity", "high",
                        "appliesTo", List.of("category", "reason"),
                        "positiveExamples", List.of("引用了原文关键信息"),
                        "negativeExamples", List.of("没有依据直接下结论"), "allowAgentAutoPass", true),
                Map.of("ruleId", "R2", "description", "理由不能为空或过短", "severity", "medium",
                        "appliesTo", List.of("reason"),
                        "positiveExamples", List.of("详细说明了判断过程"),
                        "negativeExamples", List.of("只写了一个字"), "allowAgentAutoPass", false)
        );

        return new GenerateTaskConfigResponse(
                request.taskId(), components, rules,
                List.of("相关性", "准确性", "格式合规", "安全性"),
                Map.of("mode", "auto_claim", "replicasPerItem", 1, "deadlineHours", 24, "quotaPerLabeler", 50),
                Map.of("precheckEnabled", true, "confidenceThreshold", 0.8, "modelPreference", "deepseek-chat", "promptTemplateVersionId", "auto_v1"),
                "本地兜底配置：展示项 + 单选分类 + 理由文本"
        );
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseListOfMaps(JsonNode root, String field) {
        try {
            if (root.has(field) && root.get(field).isArray()) {
                return objectMapper.convertValue(root.get(field),
                        objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));
            }
        } catch (Exception e) {
            log.warn("Failed to parse field {}: {}", field, e.getMessage());
        }
        return List.of();
    }

    private List<String> parseStringList(JsonNode root, String field) {
        try {
            if (root.has(field) && root.get(field).isArray()) {
                return objectMapper.convertValue(root.get(field),
                        objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            }
        } catch (Exception e) {
            log.warn("Failed to parse field {}: {}", field, e.getMessage());
        }
        return List.of("相关性", "准确性", "格式合规", "安全性");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseMap(JsonNode root, String field) {
        try {
            if (root.has(field) && root.get(field).isObject()) {
                return objectMapper.convertValue(root.get(field), Map.class);
            }
        } catch (Exception e) {
            log.warn("Failed to parse field {}: {}", field, e.getMessage());
        }
        return Map.of();
    }

    public List<Map<String, Object>> generateSampleData(String taskName, String instruction, int count) {
        return generateSampleData(taskName, instruction, count, null);
    }

    public List<Map<String, Object>> generateSampleData(String taskName, String instruction, int count, String ragContext) {
        agentMetrics.recordAgentCall("sample-gen", "start", 0);

        String ragSuffix = (ragContext != null && !ragContext.isBlank())
                ? "\n\n平台数据规范（必须遵守）：\n" + ragContext
                : "";

        String prompt = String.format("""
                你是一个数据标注平台的样例数据生成助手。
                任务名称: %s
                任务说明: %s

                请根据以上任务信息生成 %d 条结构化样例数据，格式为 JSON 数组。
                每条数据应包含:
                - id: 唯一编号 (sample_001, sample_002, ...)
                - content: 需要标注的原始文本内容 (必须与任务主题高度相关、真实自然)
                - metadata: 元数据对象, 包含 source(来源)和 created_at(日期)

                要求:
                1. 内容必须贴合任务名称和说明的主题
                2. 数据多样性高，覆盖不同场景
                3. 长度适中(每条 50-200 字)
                4. 只返回 JSON 数组, 不要其他文字

                返回格式:
                [{"id":"sample_001","content":"...","metadata":{"source":"...","created_at":"2026-05-20"}}]
                %s""", taskName, instruction != null ? instruction : "无", count, ragSuffix);

        if (!enabled) {
            return fallbackSampleData(taskName, count);
        }

        long startMs = System.currentTimeMillis();
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "messages", List.of(Map.of("role", "user", "content", prompt)),
                    "temperature", 0.8,
                    "max_tokens", 2000
            );

            String raw = webClient.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(30))
                    .block();

            long elapsed = System.currentTimeMillis() - startMs;
            agentMetrics.recordAgentCall("sample-gen", "success", elapsed);
            callsSuccess.increment();
            callLatency.record(Duration.ofMillis(elapsed));

            JsonNode root = objectMapper.readTree(raw);
            String content = root.path("choices").get(0).path("message").path("content").asText();

            int usage = root.path("usage").path("total_tokens").asInt(0);
            if (usage > 0) tokensUsed.increment(usage);

            String cleaned = content.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
            List<Map<String, Object>> result = objectMapper.readValue(cleaned,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));

            log.info("Generated {} sample data items for task '{}'", result.size(), taskName);
            return result;

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - startMs;
            agentMetrics.recordAgentCall("sample-gen", "error", elapsed);
            callsFallback.increment();
            log.warn("DeepSeek sample generation failed for '{}': {}", taskName, e.getMessage());
            return fallbackSampleData(taskName, count);
        }
    }

    public AiGenerateFieldResult generateField(String taskName, String instruction, List<String> existingFields, List<Map<String, Object>> sampleData) {
        return generateField(taskName, instruction, existingFields, sampleData, null);
    }

    public AiGenerateFieldResult generateField(String taskName, String instruction, List<String> existingFields, List<Map<String, Object>> sampleData, String ragContext) {
        String fieldListStr = existingFields.isEmpty() ? "无" : String.join(", ", existingFields);
        String dataPreview;
        try {
            var subset = sampleData.stream().limit(3).toList();
            dataPreview = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(subset);
        } catch (Exception e) {
            dataPreview = "无法序列化";
        }

        String ragSuffix = (ragContext != null && !ragContext.isBlank())
                ? "\n\n字段命名规范（必须遵守）：\n" + ragContext
                : "";

        String prompt = String.format("""
                你是数据标注平台的字段生成助手。
                任务名称: %s
                任务说明: %s
                现有字段: %s
                样例数据（前3条）:
                %s

                请生成一个新的、有意义的字段（列），该字段应与任务主题相关，且不与现有字段重复。
                返回一个 JSON 对象:
                {"fieldName": "字段名称", "values": ["第1行的值", "第2行的值", ...]}
                values 数组长度必须等于 %d（当前样例数据行数）。
                只返回 JSON，不要其他文字。
                %s""", taskName, instruction != null ? instruction : "无", fieldListStr, dataPreview, sampleData.size(), ragSuffix);

        if (!enabled) {
            String fallbackField = "priority";
            if (existingFields.contains("priority")) fallbackField = "category";
            if (existingFields.contains("category")) fallbackField = "difficulty";
            List<String> values = sampleData.stream().map(r -> "中").toList();
            return new AiGenerateFieldResult(fallbackField, values, "AI 未启用，已生成兜底字段");
        }

        long startMs = System.currentTimeMillis();
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "messages", List.of(Map.of("role", "user", "content", prompt)),
                    "temperature", 0.7,
                    "max_tokens", 1000
            );

            String raw = webClient.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(20))
                    .block();

            long elapsed = System.currentTimeMillis() - startMs;
            agentMetrics.recordAgentCall("field-gen", "success", elapsed);
            callsSuccess.increment();
            callLatency.record(Duration.ofMillis(elapsed));

            JsonNode root = objectMapper.readTree(raw);
            String content = root.path("choices").get(0).path("message").path("content").asText();
            String cleaned = content.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
            JsonNode parsed = objectMapper.readTree(cleaned);
            String fieldName = parsed.path("fieldName").asText("new_field");
            List<String> values = objectMapper.convertValue(parsed.path("values"),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            return new AiGenerateFieldResult(fieldName, values, "已生成字段「" + fieldName + "」");
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - startMs;
            agentMetrics.recordAgentCall("field-gen", "error", elapsed);
            log.warn("Field generation failed: {}", e.getMessage());
            List<String> values = sampleData.stream().map(r -> "").toList();
            return new AiGenerateFieldResult("new_field", values, "生成失败，已创建空白字段");
        }
    }

    public record AiGenerateFieldResult(String fieldName, List<String> values, String message) {}

    private List<Map<String, Object>> fallbackSampleData(String taskName, int count) {
        List<Map<String, Object>> all = List.of(
                Map.of("id", "sample_001", "content", "这是一条与「" + taskName + "」相关的示例文本，用于展示标注格式。", "metadata", Map.of("source", "系统生成", "created_at", "2026-05-21")),
                Map.of("id", "sample_002", "content", "第二条样例数据，展示不同场景下的标注内容。", "metadata", Map.of("source", "系统生成", "created_at", "2026-05-21")),
                Map.of("id", "sample_003", "content", "第三条样例，测试边界情况和特殊字符处理。", "metadata", Map.of("source", "系统生成", "created_at", "2026-05-21")),
                Map.of("id", "sample_004", "content", "较长的一条样例文本，模拟真实生产环境中的标注数据长度和复杂度。", "metadata", Map.of("source", "系统生成", "created_at", "2026-05-21")),
                Map.of("id", "sample_005", "content", "包含多个语义层次的样例，适合复杂标注任务的需求。", "metadata", Map.of("source", "系统生成", "created_at", "2026-05-21")),
                Map.of("id", "sample_006", "content", "最后一条样例数据，覆盖该任务类型的典型用例。", "metadata", Map.of("source", "系统生成", "created_at", "2026-05-21"))
        );
        return all.subList(0, Math.min(count, all.size()));
    }
}
