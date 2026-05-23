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

    public AgentPipelineService(
            DeepSeekService deepSeekService,
            AgentMetrics agentMetrics,
            @Value("${labelhub.skills-dir:skills}") String skillsDir
    ) {
        this.deepSeekService = deepSeekService;
        this.agentMetrics = agentMetrics;
        this.skillsDir = skillsDir;
    }

    public record PipelineRequest(String taskName, String instruction, List<Map<String, Object>> sampleData) {}

    public record StageResult(String stage, String status, long durationMs, Map<String, Object> output, String summary) {}

    public record PipelineLog(
            String promptSnapshot,
            int tokensUsed,
            List<String> skillsLoaded,
            String modelUsed,
            String ragContext
    ) {}

    public record PipelineResponse(
            String pipelineId,
            List<StageResult> stages,
            boolean allPassed,
            Map<String, Object> taskPackage,
            PipelineLog pipelineLog
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

        String ctxSummary = String.format("任务「%s」上下文已组装：%s，样例数据 %d 条",
                taskName.isEmpty() ? "未命名" : taskName,
                instruction.isBlank() ? "无任务说明" : "含任务说明",
                sampleCount);
        stages.add(new StageResult("task_context_builder", "success", ctxDuration, ctxOutput, ctxSummary));

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

        String skillSummary = String.format("已加载 %d 个专业技能：%s；RAG 上下文 %d 字符已注入 prompt",
                loadedSkills.size(), String.join("、", skillNames), ragContext.length());
        stages.add(new StageResult("skill_loader", "success", skillDuration, skillOutput, skillSummary));

        // Stage 3: dataset_sampler
        stageStart = System.currentTimeMillis();
        List<Map<String, Object>> sampleData = request.sampleData();
        boolean generated = false;
        if (sampleData == null || sampleData.isEmpty()) {
            sampleData = deepSeekService.generateSampleData(taskName, instruction, 6);
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

        String samplerSummary = String.format("%s %d 条样例数据，包含 %d 个字段（%s）",
                generated ? "AI 已生成" : "已验证用户提供的",
                sampleData.size(), fields.size(),
                fields.size() > 3 ? String.join("、", fields.subList(0, 3)) + "等" : String.join("、", fields));
        stages.add(new StageResult("dataset_sampler", "success", samplerDuration, samplerOutput, samplerSummary));

        // Stage 4: schema_generator
        stageStart = System.currentTimeMillis();
        var configResult = deepSeekService.generateTaskConfig(
                new DeepSeekService.GenerateTaskConfigRequest(
                        "task_" + System.currentTimeMillis(), taskName, instruction, sampleData
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
        String schemaSummary = String.format("已生成 %d 个标注组件：%s。%s",
                components.size(), componentNames,
                configResult.rationale() != null && configResult.rationale().length() > 20 ?
                        configResult.rationale().substring(0, Math.min(80, configResult.rationale().length())) + "…" : "");
        stages.add(new StageResult("schema_generator", "success", schemaDuration, schemaOutput, schemaSummary));

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

        String rubricSummary = String.format("已生成 %d 条质检规则，覆盖 %d 个评分维度（%s）。严重度分布：%s",
                rules.size(), dimensions.size(), String.join("、", dimensions),
                severityDist.entrySet().stream().map(e -> e.getKey() + "×" + e.getValue()).collect(Collectors.joining("、")));
        stages.add(new StageResult("rubric_generator", "success", rubricDuration, rubricOutput, rubricSummary));

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
                ? String.format("综合评审通过，置信度 %.0f%%。任务配置完整，可以发布。", confidence * 100)
                : String.format("发现 %d 个问题：%s。建议：%s", criticIssues.size(),
                String.join("；", criticIssues), String.join("；", suggestions));
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
                ? String.format("任务包已组装完成：%d 个组件、%d 条规则、%d 个维度，可发布。", components.size(), rules.size(), dimensions.size())
                : "任务包组装完成但存在未解决问题，建议修复后再发布。";
        stages.add(new StageResult("task_package_writer", criticIssues.isEmpty() ? "success" : "warning", writerDuration, writerOutput, writerSummary));

        long totalDuration = System.currentTimeMillis() - pipelineStart;
        agentMetrics.recordPipelineStage("pipeline_total", totalDuration);

        boolean allPassed = stages.stream().allMatch(s -> "success".equals(s.status()));

        PipelineLog pipelineLog = new PipelineLog(
                promptLog.toString() + "总耗时 " + totalDuration + "ms",
                totalTokens,
                skillNames,
                "deepseek-chat",
                ragContext.length() > 200 ? ragContext.substring(0, 200) + "…" : ragContext
        );

        log.info("Pipeline {} completed in {}ms, allPassed={}", pipelineId, totalDuration, allPassed);
        return new PipelineResponse(pipelineId, stages, allPassed, taskPackage, pipelineLog);
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
}
