package com.labelhub.repository;

import com.labelhub.entity.AgentRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgentRunRepository extends JpaRepository<AgentRun, String> {

    List<AgentRun> findByTaskIdAndItemIdOrderByCreatedAtDesc(String taskId, String itemId);

    Optional<AgentRun> findByTraceId(String traceId);
}
