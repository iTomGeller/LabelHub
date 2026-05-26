package com.labelhub.task.controller;

import com.labelhub.task.service.AgentRunService;
import com.labelhub.task.service.AgentRunService.AgentRunResult;
import com.labelhub.task.service.AgentRunService.AuditRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/agents/audit-runs")
public class AuditRunController {

    private final AgentRunService agentRunService;

    public AuditRunController(AgentRunService agentRunService) {
        this.agentRunService = agentRunService;
    }

    public record AuditRunRequest(
        String taskId,
        String taskName,
        String instruction,
        List<Map<String, Object>> sampleData,
        List<Map<String, Object>> schemaComponents,
        List<Map<String, Object>> rubricRules,
        List<String> rubricDimensions,
        Boolean forceRun
    ) {}

    @PostMapping
    public ResponseEntity<AgentRunResult> createOrReuseRun(@RequestBody AuditRunRequest request) {
        var auditRequest = new AuditRequest(
            request.taskId() != null ? request.taskId() : "task_" + System.currentTimeMillis(),
            request.taskName() != null ? request.taskName() : "",
            request.instruction() != null ? request.instruction() : "",
            request.sampleData() != null ? request.sampleData() : List.of(),
            request.schemaComponents() != null ? request.schemaComponents() : List.of(),
            request.rubricRules() != null ? request.rubricRules() : List.of(),
            request.rubricDimensions() != null ? request.rubricDimensions() : List.of(),
            Boolean.TRUE.equals(request.forceRun())
        );
        var result = agentRunService.executeOrReuse(auditRequest);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/recent")
    public ResponseEntity<List<Map<String, Object>>> listRecentRuns(
        @RequestParam(defaultValue = "20") int limit
    ) {
        return ResponseEntity.ok(agentRunService.listRecentRuns(limit));
    }

    @GetMapping("/{traceId}")
    public ResponseEntity<AgentRunResult> getRunByTraceId(@PathVariable String traceId) {
        var result = agentRunService.getRunByTraceId(traceId);
        if (result == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/by-task/{taskId}/latest")
    public ResponseEntity<AgentRunResult> findLatestByTask(@PathVariable String taskId) {
        var result = agentRunService.findLatestCompleteRun(taskId);
        if (result == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/by-task/{taskId}")
    public ResponseEntity<AgentRunResult> findByTaskAndHash(
        @PathVariable String taskId,
        @RequestParam(required = false) String configHash
    ) {
        if (configHash == null || configHash.isBlank()) return ResponseEntity.badRequest().build();
        var result = agentRunService.findByTaskAndHash(taskId, configHash);
        if (result == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(result);
    }
}
