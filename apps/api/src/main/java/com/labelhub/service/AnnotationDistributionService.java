package com.labelhub.service;

import com.labelhub.entity.AnnotationItem;
import com.labelhub.entity.AnnotationItemStatus;
import com.labelhub.entity.WorkflowEventLog;
import com.labelhub.repository.AnnotationItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AnnotationDistributionService {

    private final AnnotationItemRepository itemRepository;
    private final WorkflowStateMachine stateMachine;
    private final WorkflowEventPublisher eventPublisher;

    @Transactional
    public AnnotationItem claimNextItem(String taskId, String labelerId, int quota) {
        String traceId = UUID.randomUUID().toString();
        long activeCount = itemRepository.findByTaskIdAndCurrentLabelerId(taskId, labelerId).stream()
            .filter(i -> i.getStatus() != AnnotationItemStatus.REVIEW_PASSED && i.getStatus() != AnnotationItemStatus.ARCHIVED)
            .count();
        if (activeCount >= quota) {
            throw new IllegalStateException("Labeler has reached quota limit");
        }

        AnnotationItem item = itemRepository.findFirstByTaskIdAndStatusOrderByCreatedAtAsc(taskId, AnnotationItemStatus.CREATED)
            .orElseThrow(() -> new IllegalStateException("No available items to claim"));

        stateMachine.transition(item, AnnotationItemStatus.ASSIGNED);
        item.setCurrentLabelerId(labelerId);
        item = itemRepository.save(item);

        eventPublisher.publish(com.labelhub.entity.WorkflowEventType.ITEM_ASSIGNED, 
            item.getTaskId(), item.getId(), labelerId, WorkflowEventLog.ActorType.HUMAN,
            Map.of("labelerId", labelerId, "claimedAt", java.time.LocalDateTime.now().toString()), traceId);

        stateMachine.transition(item, AnnotationItemStatus.IN_PROGRESS);
        return itemRepository.save(item);
    }

    @Transactional
    public void saveDraft(String itemId, String labelerId, Map<String, Object> draft) {
        String traceId = UUID.randomUUID().toString();
        AnnotationItem item = itemRepository.findById(itemId).orElseThrow();
        if (!labelerId.equals(item.getCurrentLabelerId())) {
            throw new SecurityException("Not the assigned labeler");
        }
        item.setDraft(draft);
        itemRepository.save(item);
        eventPublisher.publish(com.labelhub.entity.WorkflowEventType.ANNOTATION_UPDATED,
            item.getTaskId(), item.getId(), labelerId, WorkflowEventLog.ActorType.HUMAN, Map.of(), traceId);
    }

    @Transactional
    public void submitAnnotation(String itemId, String labelerId, Map<String, Object> result) {
        String traceId = UUID.randomUUID().toString();
        AnnotationItem item = itemRepository.findById(itemId).orElseThrow();
        if (!labelerId.equals(item.getCurrentLabelerId())) {
            throw new SecurityException("Not the assigned labeler");
        }
        item.setAnnotationResult(result);
        stateMachine.transition(item, AnnotationItemStatus.SUBMITTED);
        item = itemRepository.save(item);

        eventPublisher.publish(com.labelhub.entity.WorkflowEventType.ANNOTATION_SUBMITTED,
            item.getTaskId(), item.getId(), labelerId, WorkflowEventLog.ActorType.HUMAN,
            Map.of("annotationResult", result), traceId);

        stateMachine.transition(item, AnnotationItemStatus.AI_REVIEW_PENDING);
        itemRepository.save(item);
    }
}
