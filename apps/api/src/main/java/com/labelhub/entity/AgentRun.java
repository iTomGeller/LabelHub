package com.labelhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "agent_run")
@Data
public class AgentRun {

    @Id
    private String id;

    @Column(nullable = false)
    private String agentName;

    @Column(nullable = false)
    private String skillName;

    @Column(nullable = false)
    private String skillVersion;

    @Column(nullable = false)
    private String taskId;

    private String itemId;

    @Column(nullable = false)
    private String traceId;

    @Column(nullable = false)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String inputSummary;

    @Column(columnDefinition = "TEXT")
    private String outputSummary;

    @Column(columnDefinition = "TEXT")
    private String contextRefsJson;

    @Column(columnDefinition = "TEXT")
    private String toolCallsJson;

    @Column(columnDefinition = "TEXT")
    private String llmCallsJson;

    private Long latencyMs;

    private Long queueWaitMs;

    private String errorCode;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;
}
