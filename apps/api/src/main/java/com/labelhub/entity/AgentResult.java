package com.labelhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "agent_result")
@Data
public class AgentResult {

    @Id
    private String id;

    @Column(nullable = false)
    private String agentRunId;

    @Column(nullable = false)
    private String taskId;

    @Column(nullable = false)
    private String itemId;

    @Column(nullable = false)
    private String resultType;

    @Column(columnDefinition = "TEXT")
    private String suggestion;

    @Column(nullable = false)
    private Double confidence;

    @Column(columnDefinition = "TEXT")
    private String evidenceJson;

    @Column(columnDefinition = "TEXT")
    private String metadataJson;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
