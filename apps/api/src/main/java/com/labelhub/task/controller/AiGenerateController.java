package com.labelhub.task.controller;

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

    public AiGenerateController(DeepSeekService deepSeekService) {
        this.deepSeekService = deepSeekService;
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

    public record GenerateRequest(
            String taskId,
            String taskName,
            String instruction,
            List<Map<String, Object>> sampleData,
            String traceId
    ) {}

    @PostMapping("/generate-task-config")
    public ResponseEntity<GenerateTaskConfigResponse> generateTaskConfig(@RequestBody GenerateRequest request) {
        var result = deepSeekService.generateTaskConfig(new GenerateTaskConfigRequest(
                request.taskId() != null ? request.taskId() : "task_" + System.currentTimeMillis(),
                request.taskName() != null ? request.taskName() : "",
                request.instruction() != null ? request.instruction() : "",
                request.sampleData() != null ? request.sampleData() : List.of()
        ));
        return ResponseEntity.ok(result);
    }
}
