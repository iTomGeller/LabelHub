package com.labelhub.task.controller;

import com.labelhub.task.service.AgentMetrics;
import com.labelhub.task.service.DeepSeekService;
import com.labelhub.task.service.DeepSeekService.GenerateTaskConfigRequest;
import com.labelhub.task.service.DeepSeekService.GenerateTaskConfigResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/agents")
public class AiGenerateController {
    private final DeepSeekService deepSeekService;
    private final AgentMetrics agentMetrics;

    public AiGenerateController(DeepSeekService deepSeekService, AgentMetrics agentMetrics) {
        this.deepSeekService = deepSeekService;
        this.agentMetrics = agentMetrics;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of(
                "status", "ok",
                "model", "deepseek-chat",
                "api_key_set", deepSeekService.isEnabled() ? "yes" : "no"
        );
    }

    @GetMapping("/metrics-summary")
    public Map<String, String> metricsSummary() {
        return Map.of(
                "calls", String.valueOf(deepSeekService.getTotalCalls()),
                "latency", deepSeekService.getAverageLatency()
        );
    }

    @GetMapping("/overview")
    public Map<String, AgentMetrics.AgentStat> agentsOverview() {
        return agentMetrics.getOverview();
    }

    public record GenerateRequest(
            String taskId,
            String taskName,
            String instruction,
            List<Map<String, Object>> sampleData,
            String traceId
    ) {}

    @PostMapping("/generate-task-config")
    public ResponseEntity<GenerateTaskConfigResponse> generateTaskConfig(@RequestBody GenerateRequest request) {
        agentMetrics.recordPipelineStage("config-gen-start", 0);
        var result = deepSeekService.generateTaskConfig(new GenerateTaskConfigRequest(
                request.taskId() != null ? request.taskId() : "task_" + System.currentTimeMillis(),
                request.taskName() != null ? request.taskName() : "",
                request.instruction() != null ? request.instruction() : "",
                request.sampleData() != null ? request.sampleData() : List.of()
        ));
        agentMetrics.recordTaskStatusChange("draft");
        return ResponseEntity.ok(result);
    }

    public record SampleDataRequest(String taskName, String instruction, Integer count) {}
    public record SampleDataResponse(List<Map<String, Object>> sampleData, String message) {}

    @PostMapping("/generate-sample-data")
    public ResponseEntity<SampleDataResponse> generateSampleData(@RequestBody SampleDataRequest request) {
        agentMetrics.recordPipelineStage("sample-gen-start", 0);
        int count = request.count() != null ? Math.max(1, Math.min(20, request.count())) : 6;
        var samples = deepSeekService.generateSampleData(
                request.taskName() != null ? request.taskName() : "未命名任务",
                request.instruction(),
                count
        );
        return ResponseEntity.ok(new SampleDataResponse(samples,
                "已根据任务「" + request.taskName() + "」生成 " + samples.size() + " 条样例数据"));
    }
}
