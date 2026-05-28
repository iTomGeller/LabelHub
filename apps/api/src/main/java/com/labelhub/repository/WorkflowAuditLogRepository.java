package com.labelhub.repository;

import com.labelhub.entity.WorkflowAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowAuditLogRepository extends JpaRepository<WorkflowAuditLog, String> {
    List<WorkflowAuditLog> findByEventId(String eventId);
}
