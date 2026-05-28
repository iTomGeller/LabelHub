package com.labelhub.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "assignments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TaskAssignment {
    
    @Id
    private String id;
    
    @Column(name = "task_id", nullable = false)
    private String taskId;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssignmentStatus status;
    
    @Column(name = "items_assigned", nullable = false)
    private Integer itemsAssigned;
    
    @Column(name = "items_completed", nullable = false)
    private Integer itemsCompleted;
    
    @Column(nullable = false)
    private Integer quota;
    
    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    public enum AssignmentStatus {
        ACTIVE, PAUSED, COMPLETED, EXPIRED
    }
}
