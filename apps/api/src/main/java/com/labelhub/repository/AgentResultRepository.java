package com.labelhub.repository;

import com.labelhub.entity.AgentResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgentResultRepository extends JpaRepository<AgentResult, String> {

    List<AgentResult> findByTaskIdAndItemIdOrderByCreatedAtDesc(String taskId, String itemId);

    Optional<AgentResult> findTopByTaskIdAndItemIdOrderByCreatedAtDesc(String taskId, String itemId);
}
