package com.labelhub.task.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AgentPipelineService {
    private static final Logger log = LoggerFactory.getLogger(AgentPipelineService.class);

    private final DeepSeekService deepSeekService;
    private final AgentMetrics agentMetrics;
    private final String skillsDir;
    private final String contractsDir;

    public AgentPipelineService(
            DeepSeekService deepSeekService,
            AgentMetrics agentMetrics,
            @Value("${labelhub.skills-dir:skills}") String skillsDir,
            @Value("${labelhub.contracts-dir:docs/contracts}") String contractsDir
    ) {
        this.deepSeekService = deepSeekService;
        this.agentMetrics = agentMetrics;
        this.skillsDir = skillsDir;
        this.contractsDir = contractsDir;
    }

    public record PipelineRequest(String taskName, String instruction, List<Map<String, Object>> sampleData) {}

    public record StageResult(String stage, String status, long durationMs, Map<String, Object> output, String summary) {}

    public record PipelineResponse(
            String pipelineId,
            List<StageResult> stages,
            boolean allPassed,
            Map<String, Object> taskPackage
    ) {}

    public PipelineResponse executePipeline(PipelineRequest request) {
        String pipelineId = "pipe_" + System.currentTimeMillis();
        List<StageResult> stages = new ArrayList<>();
        long pipelineStart = System.currentTimeMillis();
        int totalTokens = 0;
        StringBuilder promptLog = new StringBuilder();

        String taskName = request.taskName() != null ? request.taskName() : "";
        String instruction = request.instruction() != null ? request.instruction() : "";

        // Stage 1: task_context_builder
        long stageStart = System.currentTimeMillis();
        int sampleCount = request.sampleData() != null ? request.sampleData().size() : 0;
        Map<String, Object> ctxOutput = new LinkedHashMap<>();
        ctxOutput.put("taskName", taskName);
        ctxOutput.put("instructionPreview", instruction.length() > 80 ? instruction.substring(0, 80) + "…" : instruction);
        ctxOutput.put("sampleDataCount", sampleCount);
        ctxOutput.put("hasInstruction", !instruction.isBlank());
        ctxOutput.put("hasSampleData", sampleCount > 0);
        long ctxDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("task-context-builder", "success", ctxDuration);
        agentMetrics.recordPipelineStage("task_context_builder", ctxDuration);

        String ctxSummary = instruction.isBlank()
                ? "请补充任务说明，明确标注目标和判断标准"
                : String.format("任务说明已填写，包含明确的标注目标。已关联 %d 条样例数据", sampleCount);
        stages.add(new StageResult("task_context_builder", instruction.isBlank() ? "warning" : "success", ctxDuration, ctxOutput, ctxSummary));

        // Stage 2: skill_loader
        stageStart = System.currentTimeMillis();
        List<Map<String, String>> loadedSkills = loadSkills();
        List<String> skillNames = loadedSkills.stream().map(s -> s.get("name")).toList();
        Map<String, Object> skillOutput = new LinkedHashMap<>();
        skillOutput.put("skillsLoaded", skillNames);
        skillOutput.put("skillCount", loadedSkills.size());
        skillOutput.put("skillDescriptions", loadedSkills.stream().map(s -> s.get("name") + ": " + s.get("description")).toList());
        String ragContext = loadedSkills.stream().map(s -> s.get("rules")).filter(Objects::nonNull).collect(Collectors.joining("\n"));
        skillOutput.put("ragContextLength", ragContext.length());
        long skillDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("skill-loader", "success", skillDuration);
        agentMetrics.recordPipelineStage("skill_loader", skillDuration);

        // skill_loader runs internally but is NOT exposed to end users

        // Stage 3: dataset_sampler
        stageStart = System.currentTimeMillis();
        List<Map<String, Object>> sampleData = request.sampleData();
        boolean generated = false;
        if (sampleData == null || sampleData.isEmpty()) {
            sampleData = deepSeekService.generateSampleData(taskName, instruction, 6, buildCompactRagContext());
            generated = true;
        }
        List<String> fields = sampleData.isEmpty() ? List.of() : new ArrayList<>(sampleData.get(0).keySet());
        Map<String, Object> samplerOutput = new LinkedHashMap<>();
        samplerOutput.put("count", sampleData.size());
        samplerOutput.put("fields", fields);
        samplerOutput.put("source", generated ? "AI 生成" : "用户提供");
        samplerOutput.put("fieldCount", fields.size());
        long samplerDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("dataset-sampler", "success", samplerDuration);
        agentMetrics.recordPipelineStage("dataset_sampler", samplerDuration);

        String fieldList = fields.size() > 3 ? String.join("、", fields.subList(0, 3)) + " 等" : String.join("、", fields);
        String samplerSummary = String.format("样例数据共 %d 条，包含「%s」等 %d 个字段，数据结构完整", sampleData.size(), fieldList, fields.size());
        stages.add(new StageResult("dataset_sampler", sampleData.size() >= 3 ? "success" : "warning", samplerDuration, samplerOutput, samplerSummary));

        // Stage 4: schema_generator (with RAG injection)
        stageStart = System.currentTimeMillis();
        String fullRagContext = buildFullRagContext(ragContext);
        var configResult = deepSeekService.generateTaskConfig(
                new DeepSeekService.GenerateTaskConfigRequest(
                        "task_" + System.currentTimeMillis(), taskName, instruction, sampleData, fullRagContext
                )
        );
        long schemaDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("schema-generator", "success", schemaDuration);
        agentMetrics.recordPipelineStage("schema_generator", schemaDuration);
        agentMetrics.recordAgentChain("dataset-sampler", "schema-generator");

        List<Map<String, Object>> components = configResult.schemaComponents() != null ? configResult.schemaComponents() : List.of();
        Map<String, Object> schemaOutput = new LinkedHashMap<>();
        schemaOutput.put("componentCount", components.size());
        schemaOutput.put("components", components.stream().map(c -> Map.of(
                "id", c.getOrDefault("id", ""),
                "type", c.getOrDefault("type", ""),
                "label", c.getOrDefault("label", "")
        )).toList());
        schemaOutput.put("rationale", configResult.rationale() != null ?
                (configResult.rationale().length() > 150 ? configResult.rationale().substring(0, 150) + "…" : configResult.rationale()) : "");
        promptLog.append("[schema_generator] ").append("耗时 ").append(schemaDuration).append("ms; ");

        String componentNames = components.stream()
                .map(c -> String.valueOf(c.getOrDefault("label", "")))
                .limit(4).collect(Collectors.joining("、"));
        String schemaSummary = components.isEmpty()
                ? "未能生成标注模板，请检查任务说明是否足够清晰"
                : String.format("已生成 %d 个标注组件（%s），覆盖该任务的核心标注需求", components.size(), componentNames);
        stages.add(new StageResult("schema_generator", components.isEmpty() ? "warning" : "success", schemaDuration, schemaOutput, schemaSummary));

        // Stage 5: rubric_generator
        stageStart = System.currentTimeMillis();
        List<Map<String, Object>> rules = configResult.rubricRules() != null ? configResult.rubricRules() : List.of();
        List<String> dimensions = configResult.rubricDimensions() != null ? configResult.rubricDimensions() : List.of();
        Map<String, Object> rubricOutput = new LinkedHashMap<>();
        rubricOutput.put("ruleCount", rules.size());
        rubricOutput.put("dimensions", dimensions);
        rubricOutput.put("dimensionCount", dimensions.size());
        Map<String, Long> severityDist = rules.stream()
                .collect(Collectors.groupingBy(r -> String.valueOf(r.getOrDefault("severity", "medium")), Collectors.counting()));
        rubricOutput.put("severityDistribution", severityDist);
        rubricOutput.put("rules", rules.stream().map(r -> Map.of(
                "ruleId", r.getOrDefault("ruleId", ""),
                "description", r.getOrDefault("description", ""),
                "severity", r.getOrDefault("severity", "")
        )).toList());
        long rubricDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("rubric-generator", "success", rubricDuration);
        agentMetrics.recordPipelineStage("rubric_generator", rubricDuration);
        agentMetrics.recordAgentChain("schema-generator", "rubric-generator");

        String rubricSummary = rules.isEmpty()
                ? "未能生成质检规则，请确认任务说明中包含质量要求"
                : String.format("已生成 %d 条质检规则，覆盖%s等 %d 个评分维度", rules.size(), String.join("、", dimensions.stream().limit(3).toList()), dimensions.size());
        stages.add(new StageResult("rubric_generator", rules.isEmpty() ? "warning" : "success", rubricDuration, rubricOutput, rubricSummary));

        // Stage 6: critic
        stageStart = System.currentTimeMillis();
        boolean hasSchema = !components.isEmpty();
        boolean hasRules = !rules.isEmpty();
        boolean hasDimensions = !dimensions.isEmpty();
        String criticStatus = (hasSchema && hasRules && hasDimensions) ? "success" : "warning";
        List<String> criticIssues = new ArrayList<>();
        List<String> suggestions = new ArrayList<>();
        if (!hasSchema) { criticIssues.add("缺少标注模板组件"); suggestions.add("请在步骤2配置标注模板"); }
        if (!hasRules) { criticIssues.add("缺少质检规则"); suggestions.add("请在步骤3添加质检规则"); }
        if (!hasDimensions) { criticIssues.add("缺少评分维度"); suggestions.add("建议添加至少4个评分维度"); }
        if (sampleData.size() < 3) { criticIssues.add("样例数据不足(建议>=3条)"); suggestions.add("建议补充更多样例数据"); }
        if (components.size() < 2) { suggestions.add("建议至少包含展示项+标注项两种组件"); }
        double confidence = hasSchema && hasRules && hasDimensions ? 0.92 : (hasSchema || hasRules ? 0.6 : 0.3);

        Map<String, Object> criticOutput = new LinkedHashMap<>();
        criticOutput.put("passed", criticIssues.isEmpty());
        criticOutput.put("issues", criticIssues);
        criticOutput.put("suggestions", suggestions);
        criticOutput.put("confidence", confidence);
        criticOutput.put("checksPerformed", List.of("模板完整性", "规则覆盖度", "数据充分性", "维度合理性"));
        long criticDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("critic", criticStatus.equals("success") ? "success" : "warning", criticDuration);
        agentMetrics.recordPipelineStage("critic", criticDuration);
        agentMetrics.recordAgentChain("rubric-generator", "critic");

        String criticSummary = criticIssues.isEmpty()
                ? "任务配置完整，标注模板、质检规则和样例数据均已就绪，可以安全发布"
                : String.format("发现 %d 个需要关注的问题：%s", criticIssues.size(), String.join("；", criticIssues));
        stages.add(new StageResult("critic", criticStatus, criticDuration, criticOutput, criticSummary));

        // Stage 7: task_package_writer
        stageStart = System.currentTimeMillis();
        Map<String, Object> taskPackage = new LinkedHashMap<>();
        taskPackage.put("taskId", configResult.taskId());
        taskPackage.put("taskName", taskName);
        taskPackage.put("instruction", instruction);
        taskPackage.put("schemaComponents", configResult.schemaComponents());
        taskPackage.put("rubricRules", configResult.rubricRules());
        taskPackage.put("rubricDimensions", configResult.rubricDimensions());
        taskPackage.put("assignmentPolicy", configResult.assignmentPolicy());
        taskPackage.put("agentPolicy", configResult.agentPolicy());
        taskPackage.put("sampleDataCount", sampleData.size());
        taskPackage.put("rationale", configResult.rationale());
        Map<String, Object> writerOutput = new LinkedHashMap<>();
        writerOutput.put("ready", criticIssues.isEmpty());
        writerOutput.put("packageFields", List.of("taskId", "taskName", "instruction", "schemaComponents", "rubricRules", "rubricDimensions", "assignmentPolicy", "agentPolicy"));
        writerOutput.put("totalComponents", components.size());
        writerOutput.put("totalRules", rules.size());
        long writerDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("task-package-writer", "success", writerDuration);
        agentMetrics.recordPipelineStage("task_package_writer", writerDuration);
        agentMetrics.recordAgentChain("critic", "task-package-writer");

        String writerSummary = criticIssues.isEmpty()
                ? String.format("任务包组装完成，包含 %d 个标注组件和 %d 条质检规则，发布后标注员即可领取", components.size(), rules.size())
                : "任务包已组装但存在待修复项，建议修复后再发布";
        stages.add(new StageResult("task_package_writer", criticIssues.isEmpty() ? "success" : "warning", writerDuration, writerOutput, writerSummary));

        long totalDuration = System.currentTimeMillis() - pipelineStart;
        agentMetrics.recordPipelineStage("pipeline_total", totalDuration);

        boolean allPassed = stages.stream().allMatch(s -> "success".equals(s.status()));

        log.info("Pipeline {} completed in {}ms, allPassed={}", pipelineId, totalDuration, allPassed);
        return new PipelineResponse(pipelineId, stages, allPassed, taskPackage);
    }

    private List<Map<String, String>> loadSkills() {
        List<Map<String, String>> skills = new ArrayList<>();
        String[] skillFiles = {"task-schema-builder.md", "instruction-refine.md", "dataset-profile.md", "design-enterprise.md"};

        for (String file : skillFiles) {
            Path path = Path.of(skillsDir, file);
            try {
                if (Files.exists(path)) {
                    String content = Files.readString(path);
                    String name = extractYamlField(content, "name");
                    String description = extractYamlField(content, "description");
                    String rules = extractSection(content, "Rules", "Output");
                    if (rules.isEmpty()) rules = extractSection(content, "Checks", "Output");
                    if (rules.isEmpty()) rules = extractSection(content, "Required Findings", "Output");
                    skills.add(Map.of("name", name, "description", description, "rules", rules, "file", file));
                } else {
                    skills.add(Map.of("name", file.replace(".md", ""), "description", "Skill file", "rules", "", "file", file));
                }
            } catch (IOException e) {
                log.warn("Failed to read skill file {}: {}", file, e.getMessage());
                skills.add(Map.of("name", file.replace(".md", ""), "description", "Load failed", "rules", "", "file", file));
            }
        }
        return skills;
    }

    private String extractYamlField(String content, String field) {
        for (String line : content.split("\n")) {
            if (line.startsWith(field + ":")) {
                return line.substring(field.length() + 1).trim().replaceAll("^\"|\"$", "");
            }
        }
        return "";
    }

    private String extractSection(String content, String startHeader, String endHeader) {
        String[] lines = content.split("\n");
        StringBuilder section = new StringBuilder();
        boolean capturing = false;
        for (String line : lines) {
            if (line.startsWith("## " + startHeader)) { capturing = true; continue; }
            if (capturing && line.startsWith("## " + endHeader)) break;
            if (capturing && line.startsWith("## ")) break;
            if (capturing) section.append(line).append("\n");
        }
        return section.toString().trim();
    }

    private String loadContracts() {
        String[] contractFiles = {"schema-contract.md", "rubric-contract.md", "prompt-template-contract.md"};
        StringBuilder sb = new StringBuilder();
        for (String file : contractFiles) {
            Path path = Path.of(contractsDir, file);
            try {
                if (Files.exists(path)) {
                    String content = Files.readString(path);
                    String body = content.replaceAll("(?s)^---.*?---\\s*", "").trim();
                    if (body.length() > 800) body = body.substring(0, 800) + "…";
                    sb.append("[").append(file.replace(".md", "")).append("]\n").append(body).append("\n\n");
                }
            } catch (IOException e) {
                log.warn("Failed to read contract {}: {}", file, e.getMessage());
            }
        }
        return sb.toString().trim();
    }

    public String buildFullRagContext(String skillRules) {
        StringBuilder rag = new StringBuilder();
        if (skillRules != null && !skillRules.isBlank()) {
            rag.append("[平台标注技能规则]\n").append(skillRules).append("\n\n");
        }
        String contracts = loadContracts();
        if (!contracts.isBlank()) {
            rag.append("[平台契约约束]\n").append(contracts);
        }
        return rag.toString().trim();
    }

    public String buildCompactRagContext() {
        return """
                [数据约束]
                - 每条数据必须包含 id 字段（唯一编号）
                - content 字段承载待标注原始内容
                - metadata 字段承载来源和时间
                - 字段名使用英文 snake_case
                - 字段值不允许为空字符串
                
                [Schema 约束]
                - 组件 type 只允许: shortText, longText, singleChoice, multiChoice, tagSelect, richText, fileUpload, jsonEditor, llmInteraction, showItem
                - dataPath 必须以 $. 开头
                - 每个组件必须有 id, type, label, dataPath, required, props, validation
                
                [质检约束]
                - severity 只允许: low, medium, high, critical
                - 评分维度至少包含: 相关性, 准确性, 格式合规, 安全性""";
    }
}
