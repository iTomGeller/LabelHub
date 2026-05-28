package com.labelhub.service;

import com.labelhub.entity.*;
import com.labelhub.repository.WorkflowEventLogRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkflowEventPublisher {

    @Getter
    private final WorkflowEventLogRepository eventLogRepository;
    private final StringRedisTemplate redisTemplate;

    public void publish(WorkflowEventType eventType, String taskId, String itemId,
                       String actorId, WorkflowEventLog.ActorType actorType,
                       Map<String, Object> payload, String traceId) {

        WorkflowEventLog event = new WorkflowEventLog();
        event.setEventId(UUID.randomUUID().toString());
        event.setEventType(eventType);
        event.setTaskId(taskId);
        event.setItemId(itemId);
        event.setActorId(actorId);
        event.setActorType(actorType);
        event.setPayload(payload);
        event.setTraceId(traceId != null ? traceId : UUID.randomUUID().toString());

        eventLogRepository.save(event);

        redisTemplate.opsForStream().add("labelhub.workflow.events", Map.of(
                "eventId", event.getEventId(),
                "eventType", eventType.name(),
                "taskId", taskId,
                "itemId", itemId,
                "traceId", event.getTraceId()
        ));
    }
}
