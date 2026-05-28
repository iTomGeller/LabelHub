package com.labelhub.service;

import com.labelhub.entity.AnnotationItem;
import com.labelhub.entity.AnnotationItemStatus;
import com.labelhub.entity.WorkflowEventLog;
import com.labelhub.repository.AnnotationItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReviewWorkbenchService {

    private final AnnotationItemRepository itemRepository;
    private final WorkflowStateMachine stateMachine;
    private final WorkflowEventPublisher eventPublisher;

    @Transactional
    public void assignForManualReview(String itemId, String reviewerId) {
        String traceId = UUID.randomUUID().toString();
        AnnotationItem item = itemRepository.findById(itemId).orElseThrow();
        stateMachine.transition(item, AnnotationItemStatus.MANUAL_REVIEW_PENDING);
        item.setCurrentReviewerId(reviewerId);
        itemRepository.save(item);
        
        eventPublisher.publish(com.labelhub.entity.WorkflowEventType.ITEM_ASSIGNED,
            item.getTaskId(), item.getId(), reviewerId, WorkflowEventLog.ActorType.HUMAN,
            Map.of("reviewerId", reviewerId), traceId);
    }

    @Transactional
    public void passReview(String itemId, String reviewerId, String comment) {
        String traceId = UUID.randomUUID().toString();
        AnnotationItem item = itemRepository.findById(itemId).orElseThrow();
        stateMachine.transition(item, AnnotationItemStatus.REVIEW_PASSED);
        item.setReviewComment(comment);
        item = itemRepository.save(item);

        eventPublisher.publish(com.labelhub.entity.WorkflowEventType.REVIEW_PASSED_EVENT,
            item.getTaskId(), item.getId(), reviewerId, WorkflowEventLog.ActorType.HUMAN,
            Map.of("reviewComment", comment, "reviewRound", item.getReviewRound()), traceId);
    }

    @Transactional
    public void rejectReview(String itemId, String reviewerId, String reason) {
        String traceId = UUID.randomUUID().toString();
        AnnotationItem item = itemRepository.findById(itemId).orElseThrow();
        stateMachine.transition(item, AnnotationItemStatus.IN_PROGRESS);
        item.setReviewComment(reason);
        item.setReviewRound(item.getReviewRound() + 1);
        item = itemRepository.save(item);

        eventPublisher.publish(com.labelhub.entity.WorkflowEventType.REVIEW_REJECTED_EVENT,
            item.getTaskId(), item.getId(), reviewerId, WorkflowEventLog.ActorType.HUMAN,
            Map.of("rejectReason", reason, "reviewRound", item.getReviewRound()), traceId);
    }

    @Transactional
    public void batchPass(List<String> itemIds, String reviewerId, String commonComment) {
        for (String itemId : itemIds) {
            passReview(itemId, reviewerId, commonComment);
        }
    }

    @Transactional(readOnly = true)
    public List<WorkflowEventLog> getItemAuditTrail(String taskId, String itemId) {
        return eventPublisher.getEventLogRepository().findByTaskIdAndItemIdOrderByTimestampAsc(taskId, itemId);
    }
}
