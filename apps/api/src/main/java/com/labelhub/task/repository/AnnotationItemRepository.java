package com.labelhub.task.repository;

import com.labelhub.task.entity.AnnotationItem;
import com.labelhub.task.entity.AnnotationItemStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnnotationItemRepository extends JpaRepository<AnnotationItem, String> {

    List<AnnotationItem> findByTaskIdAndCurrentLabelerId(String taskId, String labelerId);

    Optional<AnnotationItem> findFirstByTaskIdAndStatusOrderByCreatedAtAsc(String taskId, AnnotationItemStatus status);

    Page<AnnotationItem> findByTaskIdAndStatus(String taskId, AnnotationItemStatus status, Pageable pageable);

    List<AnnotationItem> findByTaskIdAndStatus(String taskId, AnnotationItemStatus status);

    List<AnnotationItem> findByTaskId(String taskId);
}
