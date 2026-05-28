package com.labelhub.repository;

import com.labelhub.entity.AnnotationItem;
import com.labelhub.entity.AnnotationItemStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnnotationItemRepository extends JpaRepository<AnnotationItem, String> {
    Page<AnnotationItem> findByTaskIdAndStatus(String taskId, AnnotationItemStatus status, Pageable pageable);
    List<AnnotationItem> findByTaskIdAndCurrentLabelerId(String taskId, String labelerId);
    List<AnnotationItem> findByTaskIdAndCurrentReviewerId(String taskId, String reviewerId);
    List<AnnotationItem> findByTaskIdAndStatus(String taskId, AnnotationItemStatus status);
    List<AnnotationItem> findByTaskId(String taskId);
    Optional<AnnotationItem> findFirstByTaskIdAndStatusOrderByCreatedAtAsc(String taskId, AnnotationItemStatus status);
    long countByTaskIdAndStatus(String taskId, AnnotationItemStatus status);
}
