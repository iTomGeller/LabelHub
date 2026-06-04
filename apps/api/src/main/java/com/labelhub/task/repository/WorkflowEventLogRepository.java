package com.labelhub.task.repository;

import com.labelhub.task.entity.WorkflowEventLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowEventLogRepository extends JpaRepository<WorkflowEventLog, String> {
    List<WorkflowEventLog> findByTaskIdAndItemIdOrderByTimestampAsc(String taskId, String itemId);
    List<WorkflowEventLog> findByTaskIdOrderByTimestampAsc(String taskId);
}
