package com.labelhub.service;

import com.labelhub.entity.AnnotationItem;
import com.labelhub.entity.AnnotationItemStatus;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.Map;

@Component
public class WorkflowStateMachine {

    private static final Map<AnnotationItemStatus, EnumSet<AnnotationItemStatus>> VALID_TRANSITIONS = Map.of(
        AnnotationItemStatus.CREATED, EnumSet.of(AnnotationItemStatus.ASSIGNED),
        AnnotationItemStatus.ASSIGNED, EnumSet.of(AnnotationItemStatus.IN_PROGRESS),
        AnnotationItemStatus.IN_PROGRESS, EnumSet.of(AnnotationItemStatus.SUBMITTED, AnnotationItemStatus.IN_PROGRESS),
        AnnotationItemStatus.SUBMITTED, EnumSet.of(AnnotationItemStatus.AI_REVIEW_PENDING),
        AnnotationItemStatus.AI_REVIEW_PENDING, EnumSet.of(AnnotationItemStatus.AI_REVIEWED),
        AnnotationItemStatus.AI_REVIEWED, EnumSet.of(AnnotationItemStatus.MANUAL_REVIEW_PENDING, AnnotationItemStatus.REVIEW_PASSED),
        AnnotationItemStatus.MANUAL_REVIEW_PENDING, EnumSet.of(AnnotationItemStatus.REVIEW_PASSED, AnnotationItemStatus.REVIEW_REJECTED),
        AnnotationItemStatus.REVIEW_REJECTED, EnumSet.of(AnnotationItemStatus.IN_PROGRESS),
        AnnotationItemStatus.REVIEW_PASSED, EnumSet.of(AnnotationItemStatus.ARCHIVED)
    );

    public void transition(AnnotationItem item, AnnotationItemStatus targetStatus) {
        AnnotationItemStatus current = item.getStatus();
        if (!isValidTransition(current, targetStatus)) {
            throw new IllegalStateException("Cannot transition from " + current + " to " + targetStatus);
        }
        item.setStatus(targetStatus);
        item.setUpdatedAt(java.time.LocalDateTime.now());
    }

    public boolean isValidTransition(AnnotationItemStatus from, AnnotationItemStatus to) {
        return VALID_TRANSITIONS.getOrDefault(from, EnumSet.noneOf(AnnotationItemStatus.class)).contains(to);
    }
}
