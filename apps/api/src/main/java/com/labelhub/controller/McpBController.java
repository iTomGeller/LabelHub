package com.labelhub.controller;

import com.labelhub.entity.*;
import com.labelhub.repository.*;
import com.labelhub.service.AssignmentAgentService;
import com.labelhub.service.ReviewAssistAgentService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/v1/mcp/b")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class McpBController {

    private final AnnotationItemRepository itemRepository;
    private final WorkflowEventLogRepository eventLogRepository;
    private final TaskAssignmentRepository assignmentRepository;
    private final AgentResultRepository agentResultRepository;
    private final AgentRunRepository agentRunRepository;
    private final AssignmentAgentService assignmentAgentService;
    private final ReviewAssistAgentService reviewAssistAgentService;

    @Data
    public static class McpResponse<T> {
        private boolean ok;
        private T data;
        private McpError error;
        private String traceId;
        private long latencyMs;
    }

    @Data
    public static class McpError {
        private String errorCode;
        private String message;
        private boolean retryable;
    }

    private <T> McpResponse<T> success(T data, String traceId, long startNanos) {
        McpResponse<T> resp = new McpResponse<>();
        resp.setOk(true);
        resp.setData(data);
        resp.setTraceId(traceId);
        resp.setLatencyMs((System.nanoTime() - startNanos) / 1_000_000);
        return resp;
    }

    private <T> McpResponse<T> error(String code, String msg, boolean retryable, String traceId, long startNanos) {
        McpResponse<T> resp = new McpResponse<>();
        resp.setOk(false);
        McpError err = new McpError();
        err.setErrorCode(code);
        err.setMessage(msg);
        err.setRetryable(retryable);
        resp.setError(err);
        resp.setTraceId(traceId);
        resp.setLatencyMs((System.nanoTime() - startNanos) / 1_000_000);
        return resp;
    }

    @GetMapping("/annotation.getSubmitted")
    public McpResponse<List<AnnotationItem>> getSubmitted(@RequestParam String taskId) {
        long start = System.nanoTime();
        String traceId = UUID.randomUUID().toString();
        try {
            List<AnnotationItem> items = itemRepository.findByTaskIdAndStatus(taskId, AnnotationItemStatus.SUBMITTED);
            return success(items, traceId, start);
        } catch (Exception e) {
            return error("QUERY_FAILED", e.getMessage(), true, traceId, start);
        }
    }

    @PostMapping("/annotation.lookupSimilar")
    public McpResponse<List<ReviewAssistAgentService.SimilarCase>> lookupSimilar(
            @RequestBody LookupSimilarRequest req) {
        long start = System.nanoTime();
        String traceId = UUID.randomUUID().toString();
        try {
            List<ReviewAssistAgentService.SimilarCase> cases = 
                reviewAssistAgentService.lookupSimilarCases(req.taskId, req.annotationResult);
            return success(cases, traceId, start);
        } catch (Exception e) {
            return error("SIMILAR_LOOKUP_FAILED", e.getMessage(), true, traceId, start);
        }
    }

    @Data
    public static class LookupSimilarRequest {
        String taskId;
        Map<String, Object> annotationResult;
    }

    @GetMapping("/review.getHistory")
    public McpResponse<List<WorkflowEventLog>> getReviewHistory(@RequestParam String taskId, @RequestParam(required = false) String itemId) {
        long start = System.nanoTime();
        String traceId = UUID.randomUUID().toString();
        try {
            List<WorkflowEventLog> logs;
            if (itemId != null) {
                logs = eventLogRepository.findByTaskIdAndItemIdOrderByTimestampAsc(taskId, itemId);
            } else {
                logs = eventLogRepository.findByTaskIdOrderByTimestampAsc(taskId);
            }
            return success(logs, traceId, start);
        } catch (Exception e) {
            return error("HISTORY_QUERY_FAILED", e.getMessage(), true, traceId, start);
        }
    }

    @GetMapping("/workflow.getAuditTrail")
    public McpResponse<List<WorkflowEventLog>> getAuditTrail(@RequestParam String taskId, @RequestParam String itemId) {
        long start = System.nanoTime();
        String traceId = UUID.randomUUID().toString();
        try {
            List<WorkflowEventLog> logs = eventLogRepository.findByTaskIdAndItemIdOrderByTimestampAsc(taskId, itemId);
            return success(logs, traceId, start);
        } catch (Exception e) {
            return error("AUDIT_TRAIL_FAILED", e.getMessage(), true, traceId, start);
        }
    }

    @GetMapping("/assignment.getLoad")
    public McpResponse<AssignmentAgentService.AssignmentSuggestion> getAssignmentLoad(@RequestParam String taskId) {
        long start = System.nanoTime();
        String traceId = UUID.randomUUID().toString();
        try {
            AssignmentAgentService.AssignmentSuggestion suggestion = 
                assignmentAgentService.getAssignmentSuggestions(taskId);
            return success(suggestion, traceId, start);
        } catch (Exception e) {
            return error("LOAD_SUGGESTION_FAILED", e.getMessage(), false, traceId, start);
        }
    }

    @GetMapping("/agent.getResults")
    public McpResponse<List<AgentResult>> getAgentResults(@RequestParam String taskId, @RequestParam String itemId) {
        long start = System.nanoTime();
        String traceId = UUID.randomUUID().toString();
        try {
            List<AgentResult> results = agentResultRepository.findByTaskIdAndItemIdOrderByCreatedAtDesc(taskId, itemId);
            return success(results, traceId, start);
        } catch (Exception e) {
            return error("AGENT_RESULTS_FAILED", e.getMessage(), true, traceId, start);
        }
    }

    @GetMapping("/agent.getRun")
    public McpResponse<Optional<AgentRun>> getAgentRun(@RequestParam String traceId) {
        long start = System.nanoTime();
        String traceIdResp = UUID.randomUUID().toString();
        try {
            Optional<AgentRun> run = agentRunRepository.findByTraceId(traceId);
            return success(run, traceIdResp, start);
        } catch (Exception e) {
            return error("AGENT_RUN_FAILED", e.getMessage(), true, traceIdResp, start);
        }
    }
}
