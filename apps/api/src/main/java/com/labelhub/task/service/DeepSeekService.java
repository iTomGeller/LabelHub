package com.labelhub.task.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class DeepSeekService {
    private static final Logger log = LoggerFactory.getLogger(DeepSeekService.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String model;
    private final boolean enabled;

    public DeepSeekService(
            @Value("${deepseek.api-key:}") String apiKey,
            @Value("${deepseek.base-url:https://api.deepseek.com}") String baseUrl,
            @Value("${deepseek.model:deepseek-chat}") String model,
            ObjectMapper objectMapper
    ) {
        this.model = model;
        this.objectMapper = objectMapper;
        this.enabled = apiKey != null && !apiKey.isBlank();

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
            List<Map<String, Object>> sampleData
    ) {}

    public record GenerateTaskConfigResponse(
            String taskId,
            List<Map<String, Object>> schemaComponents,
            List<Map<String, Object>> rubricRules,
            List<String> rubricDimensions,
            Map<String, Object> assignmentPolicy,
            Map<String, Object> agentPolicy,
            String rationale
    ) {}

    public GenerateTaskConfigResponse generateTaskConfig(GenerateTaskConfigRequest request) {
        if (!enabled) {
            log.warn("DeepSeek API key not configured, returning fallback config");
            return fallbackConfig(request);
        }

        String samplePreview;
        try {
            var subset = request.sampleData().stream().limit(3).toList();
            samplePreview = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(subset);
        } catch (JsonProcessingException e) {
            samplePreview = "无法序列化样例数据";
        }

        String systemPrompt = """
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

            JsonNode root = objectMapper.readTree(responseBody);
            String content = root.path("choices").path(0).path("message").path("content").asText("{}");
            JsonNode result = objectMapper.readTree(content);

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
}
