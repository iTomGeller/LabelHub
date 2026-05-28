package com.labelhub.repository;

import com.labelhub.entity.SlaJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SlaJobRepository extends JpaRepository<SlaJob, String> {
    List<SlaJob> findByTaskId(String taskId);
    List<SlaJob> findByStatusAndScheduledAtBefore(String status, LocalDateTime time);
}
