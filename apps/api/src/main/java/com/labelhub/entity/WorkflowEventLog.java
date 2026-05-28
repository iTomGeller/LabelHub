package com.labelhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "workflow_events")
@Data
public class WorkflowEventLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String eventId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private WorkflowEventType eventType;

    @Column(nullable = false)
    private String taskId;

    @Column(nullable = false)
    private String itemId;

    @Column(nullable = false)
    private String actorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ActorType actorType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSON")
    private Map<String, Object> payload = new HashMap<>();

    private String traceId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp;

    public enum ActorType {
        HUMAN,
        AGENT,
        SYSTEM
    }
}
