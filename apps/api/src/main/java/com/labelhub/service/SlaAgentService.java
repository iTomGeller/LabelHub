package com.labelhub.service;

import com.labelhub.entity.AnnotationItem;
import com.labelhub.entity.AnnotationItemStatus;
import com.labelhub.entity.SlaJob;
import com.labelhub.entity.WorkflowEventLog;
import com.labelhub.repository.AnnotationItemRepository;
import com.labelhub.repository.SlaJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@EnableScheduling
@RequiredArgsConstructor
public class SlaAgentService {

    private final AnnotationItemRepository itemRepository;
    private final SlaJobRepository slaJobRepository;
    private final WorkflowEventPublisher eventPublisher;

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void checkTimeouts() {
        LocalDateTime timeoutThreshold = LocalDateTime.now().minusHours(2);
        List<AnnotationItem> allItems = itemRepository.findAll();
        List<AnnotationItem> timedOutItems = allItems.stream()
            .filter(i -> i.getStatus() == AnnotationItemStatus.IN_PROGRESS)
            .filter(i -> i.getUpdatedAt().isBefore(timeoutThreshold))
            .toList();

        for (AnnotationItem item : timedOutItems) {
            releaseLock(item);
        }
    }

    @Transactional
    public void releaseLock(AnnotationItem item) {
        String traceId = UUID.randomUUID().toString();
        SlaJob job = new SlaJob();
        job.setId(UUID.randomUUID().toString());
        job.setTaskId(item.getTaskId());
        job.setItemId(item.getId());
        job.setJobType("TIMEOUT_RELEASE");
        job.setStatus("COMPLETED");
        job.setScheduledAt(LocalDateTime.now());
        job.setExecutedAt(LocalDateTime.now());
        slaJobRepository.save(job);

        String oldLabelerId = item.getCurrentLabelerId();
        item.setCurrentLabelerId(null);
        item.setStatus(AnnotationItemStatus.CREATED);
        itemRepository.save(item);

        eventPublisher.publish(
            com.labelhub.entity.WorkflowEventType.ITEM_ASSIGNED,
            item.getTaskId(),
            item.getId(),
            "system-sla-agent",
            WorkflowEventLog.ActorType.SYSTEM,
            Map.of("previousLabelerId", oldLabelerId, "action", "timeout_released"),
            traceId
        );
    }
}
