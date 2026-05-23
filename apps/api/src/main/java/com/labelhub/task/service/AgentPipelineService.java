package com.labelhub.task.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class AgentPipelineService {
    private static final Logger log = LoggerFactory.getLogger(AgentPipelineService.class);

    private final DeepSeekService deepSeekService;
    private final AgentMetrics agentMetrics;

    public AgentPipelineService(DeepSeekService deepSeekService, AgentMetrics agentMetrics) {
        this.deepSeekService = deepSeekService;
        this.agentMetrics = agentMetrics;
    }

    public record PipelineRequest(
            String taskName,
            String instruction,
            List<Map<String, Object>> sampleData
    ) {}

    public record StageResult(String stage, String status, long durationMs, Object output) {}
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

        // Stage 1: task_context_builder
        long stageStart = System.currentTimeMillis();
        Map<String, Object> context = Map.of(
                "taskName", request.taskName() != null ? request.taskName() : "",
                "instruction", request.instruction() != null ? request.instruction() : "",
                "sampleDataCount", request.sampleData() != null ? request.sampleData().size() : 0
        );
        agentMetrics.recordAgentCall("task-context-builder", "success", System.currentTimeMillis() - stageStart);
        agentMetrics.recordPipelineStage("task_context_builder", System.currentTimeMillis() - stageStart);
        stages.add(new StageResult("task_context_builder", "success", System.currentTimeMillis() - stageStart, context));

        // Stage 2: skill_loader
        stageStart = System.currentTimeMillis();
        List<String> skills = List.of("task-schema-builder", "instruction-refine", "dataset-profile", "design-enterprise");
        agentMetrics.recordAgentCall("skill-loader", "success", System.currentTimeMillis() - stageStart);
        agentMetrics.recordPipelineStage("skill_loader", System.currentTimeMillis() - stageStart);
        stages.add(new StageResult("skill_loader", "success", System.currentTimeMillis() - stageStart, Map.of("skills", skills)));

        // Stage 3: dataset_sampler
        stageStart = System.currentTimeMillis();
        List<Map<String, Object>> sampleData = request.sampleData();
        if (sampleData == null || sampleData.isEmpty()) {
            sampleData = deepSeekService.generateSampleData(request.taskName(), request.instruction(), 6);
        }
        long samplerDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("dataset-sampler", "success", samplerDuration);
        agentMetrics.recordPipelineStage("dataset_sampler", samplerDuration);
        stages.add(new StageResult("dataset_sampler", "success", samplerDuration, Map.of("count", sampleData.size())));

        // Stage 4: schema_generator
        stageStart = System.currentTimeMillis();
        var configResult = deepSeekService.generateTaskConfig(
                new DeepSeekService.GenerateTaskConfigRequest(
                        "task_" + System.currentTimeMillis(),
                        request.taskName() != null ? request.taskName() : "",
                        request.instruction() != null ? request.instruction() : "",
                        sampleData
                )
        );
        long schemaDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("schema-generator", "success", schemaDuration);
        agentMetrics.recordPipelineStage("schema_generator", schemaDuration);
        agentMetrics.recordAgentChain("dataset-sampler", "schema-generator");
        stages.add(new StageResult("schema_generator", "success", schemaDuration,
                Map.of("componentCount", configResult.schemaComponents() != null ? configResult.schemaComponents().size() : 0)));

        // Stage 5: rubric_generator
        stageStart = System.currentTimeMillis();
        long rubricDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("rubric-generator", "success", rubricDuration);
        agentMetrics.recordPipelineStage("rubric_generator", rubricDuration);
        agentMetrics.recordAgentChain("schema-generator", "rubric-generator");
        stages.add(new StageResult("rubric_generator", "success", rubricDuration,
                Map.of("ruleCount", configResult.rubricRules() != null ? configResult.rubricRules().size() : 0)));

        // Stage 6: critic
        stageStart = System.currentTimeMillis();
        boolean hasSchema = configResult.schemaComponents() != null && !configResult.schemaComponents().isEmpty();
        boolean hasRules = configResult.rubricRules() != null && !configResult.rubricRules().isEmpty();
        boolean hasDimensions = configResult.rubricDimensions() != null && !configResult.rubricDimensions().isEmpty();
        String criticStatus = (hasSchema && hasRules && hasDimensions) ? "success" : "warning";
        List<String> criticIssues = new ArrayList<>();
        if (!hasSchema) criticIssues.add("缺少标注模板组件");
        if (!hasRules) criticIssues.add("缺少质检规则");
        if (!hasDimensions) criticIssues.add("缺少评分维度");
        if (sampleData.size() < 3) criticIssues.add("样例数据不足(建议>=3条)");
        long criticDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("critic", criticStatus.equals("success") ? "success" : "warning", criticDuration);
        agentMetrics.recordPipelineStage("critic", criticDuration);
        agentMetrics.recordAgentChain("rubric-generator", "critic");
        stages.add(new StageResult("critic", criticStatus, criticDuration,
                Map.of("passed", criticIssues.isEmpty(), "issues", criticIssues)));

        // Stage 7: task_package_writer
        stageStart = System.currentTimeMillis();
        Map<String, Object> taskPackage = new LinkedHashMap<>();
        taskPackage.put("taskId", configResult.taskId());
        taskPackage.put("taskName", request.taskName());
        taskPackage.put("instruction", request.instruction());
        taskPackage.put("schemaComponents", configResult.schemaComponents());
        taskPackage.put("rubricRules", configResult.rubricRules());
        taskPackage.put("rubricDimensions", configResult.rubricDimensions());
        taskPackage.put("assignmentPolicy", configResult.assignmentPolicy());
        taskPackage.put("agentPolicy", configResult.agentPolicy());
        taskPackage.put("sampleDataCount", sampleData.size());
        taskPackage.put("rationale", configResult.rationale());
        long writerDuration = System.currentTimeMillis() - stageStart;
        agentMetrics.recordAgentCall("task-package-writer", "success", writerDuration);
        agentMetrics.recordPipelineStage("task_package_writer", writerDuration);
        agentMetrics.recordAgentChain("critic", "task-package-writer");
        stages.add(new StageResult("task_package_writer", "success", writerDuration, Map.of("ready", true)));

        long totalDuration = System.currentTimeMillis() - pipelineStart;
        agentMetrics.recordPipelineStage("pipeline_total", totalDuration);

        boolean allPassed = stages.stream().allMatch(s -> "success".equals(s.status()));
        log.info("Pipeline {} completed in {}ms, allPassed={}", pipelineId, totalDuration, allPassed);

        return new PipelineResponse(pipelineId, stages, allPassed, taskPackage);
    }
}
