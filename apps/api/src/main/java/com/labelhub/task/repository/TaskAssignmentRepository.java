package com.labelhub.task.repository;

import com.labelhub.task.entity.TaskAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskAssignmentRepository extends JpaRepository<TaskAssignment, String> {
    List<TaskAssignment> findByTaskId(String taskId);
    Optional<TaskAssignment> findByTaskIdAndUserId(String taskId, String userId);
}
