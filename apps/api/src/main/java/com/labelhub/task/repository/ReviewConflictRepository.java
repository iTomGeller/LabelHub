package com.labelhub.task.repository;

import com.labelhub.task.entity.ReviewConflict;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReviewConflictRepository extends JpaRepository<ReviewConflict, String> {
    Optional<ReviewConflict> findByTaskIdAndItemId(String taskId, String itemId);
    List<ReviewConflict> findByTaskId(String taskId);
}
