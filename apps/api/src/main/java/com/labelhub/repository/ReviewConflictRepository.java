package com.labelhub.repository;

import com.labelhub.entity.ReviewConflict;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReviewConflictRepository extends JpaRepository<ReviewConflict, String> {
    List<ReviewConflict> findByTaskId(String taskId);
    List<ReviewConflict> findByItemId(String itemId);
    Optional<ReviewConflict> findByTaskIdAndItemId(String taskId, String itemId);
}
