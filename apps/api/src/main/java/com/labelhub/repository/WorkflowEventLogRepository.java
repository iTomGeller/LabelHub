package com.labelhub.repository;

import com.labelhub.entity.WorkflowEventLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WorkflowEventLogRepository extends JpaRepository<WorkflowEventLog, String> {
    List<WorkflowEventLog> findByTaskIdAndItemIdOrderByTimestampAsc(String taskId, String itemId);
    List<WorkflowEventLog> findByTaskIdOrderByTimestampAsc(String taskId);
}
