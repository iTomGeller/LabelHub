package com.labelhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "annotation_drafts")
@Data
public class AnnotationDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String itemId;

    @Column(nullable = false)
    private String labelerId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSON", nullable = false)
    private Map<String, Object> draftJson = new HashMap<>();

    @Column(nullable = false)
    private LocalDateTime savedAt;
}
