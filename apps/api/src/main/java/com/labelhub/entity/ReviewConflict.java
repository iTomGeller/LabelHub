package com.labelhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "review_conflicts")
@Data
public class ReviewConflict {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String taskId;

    @Column(nullable = false)
    private String itemId;

    @Column(nullable = false, length = 30)
    private String status;

    private String labelerAId;

    private String labelerBId;

    @Column(length = 2000)
    private String resolutionNote;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
