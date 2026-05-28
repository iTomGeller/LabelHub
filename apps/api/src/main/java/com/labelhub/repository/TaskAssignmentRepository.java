package com.labelhub.repository;

import com.labelhub.entity.TaskAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskAssignmentRepository extends JpaRepository<TaskAssignment, String> {
    List<TaskAssignment> findByTaskId(String taskId);
    List<TaskAssignment> findByUserId(String userId);
    Optional<TaskAssignment> findByTaskIdAndUserId(String taskId, String userId);
}
