package com.labelhub.controller;

import com.labelhub.entity.AnnotationItem;
import com.labelhub.entity.AnnotationItemStatus;
import com.labelhub.entity.WorkflowEventLog;
import com.labelhub.repository.AnnotationItemRepository;
import com.labelhub.service.AnnotationDistributionService;
import com.labelhub.service.ReviewWorkbenchService;
import com.labelhub.service.StatisticsService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/annotation")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AnnotationController {

    private final AnnotationDistributionService distributionService;
    private final ReviewWorkbenchService reviewService;
    private final AnnotationItemRepository itemRepository;
    private final StatisticsService statisticsService;

    @Data
    public static class ClaimRequest { String taskId; String labelerId; int quota; }
    @Data
    public static class DraftRequest { Map<String, Object> draft; }
    @Data
    public static class SubmitRequest { Map<String, Object> result; }
    @Data
    public static class ReviewRequest { String comment; }
    @Data
    public static class RejectRequest { String reason; }
    @Data
    public static class BatchReviewRequest { List<String> itemIds; String comment; }

    @PostMapping("/claim")
    public AnnotationItem claim(@RequestBody ClaimRequest req) {
        return distributionService.claimNextItem(req.getTaskId(), req.getLabelerId(), req.getQuota());
    }

    @PostMapping("/{itemId}/draft")
    public void saveDraft(@PathVariable String itemId, @RequestParam String labelerId, @RequestBody DraftRequest req) {
        distributionService.saveDraft(itemId, labelerId, req.getDraft());
    }

    @PostMapping("/{itemId}/submit")
    public void submit(@PathVariable String itemId, @RequestParam String labelerId, @RequestBody SubmitRequest req) {
        distributionService.submitAnnotation(itemId, labelerId, req.getResult());
    }

    @GetMapping("/tasks/{taskId}/status/{status}")
    public Page<AnnotationItem> listByStatus(@PathVariable String taskId, @PathVariable AnnotationItemStatus status, Pageable pageable) {
        return itemRepository.findByTaskIdAndStatus(taskId, status, pageable);
    }

    @PostMapping("/review/{itemId}/pass")
    public void pass(@PathVariable String itemId, @RequestParam String reviewerId, @RequestBody ReviewRequest req) {
        reviewService.passReview(itemId, reviewerId, req.getComment());
    }

    @PostMapping("/review/{itemId}/reject")
    public void reject(@PathVariable String itemId, @RequestParam String reviewerId, @RequestBody RejectRequest req) {
        reviewService.rejectReview(itemId, reviewerId, req.getReason());
    }

    @PostMapping("/review/batch-pass")
    public void batchPass(@RequestParam String reviewerId, @RequestBody BatchReviewRequest req) {
        reviewService.batchPass(req.getItemIds(), reviewerId, req.getComment());
    }

    @GetMapping("/{itemId}/audit-trail")
    public List<WorkflowEventLog> auditTrail(@RequestParam String taskId, @PathVariable String itemId) {
        return reviewService.getItemAuditTrail(taskId, itemId);
    }

    @GetMapping("/stats/production/{taskId}")
    public StatisticsService.ProductionStats getProductionStats(@PathVariable String taskId) {
        return statisticsService.getProductionStats(taskId);
    }

    @GetMapping("/stats/schema-feedback/{taskId}")
    public StatisticsService.SchemaUsageFeedback getSchemaUsageFeedback(@PathVariable String taskId) {
        return statisticsService.getSchemaUsageFeedback(taskId);
    }

    @GetMapping("/stats/review-summary/{taskId}")
    public StatisticsService.ReviewFeedbackSummary getReviewFeedbackSummary(@PathVariable String taskId) {
        return statisticsService.getReviewFeedbackSummary(taskId);
    }
}
