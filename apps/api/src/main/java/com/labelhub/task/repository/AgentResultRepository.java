package com.labelhub.task.repository;

import com.labelhub.task.entity.AgentResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AgentResultRepository extends JpaRepository<AgentResult, String> {
    List<AgentResult> findByTaskIdAndItemIdOrderByCreatedAtDesc(String taskId, String itemId);
}
