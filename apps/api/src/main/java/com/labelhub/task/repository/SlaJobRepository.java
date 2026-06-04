package com.labelhub.task.repository;

import com.labelhub.task.entity.SlaJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SlaJobRepository extends JpaRepository<SlaJob, String> {
    List<SlaJob> findByTaskId(String taskId);
    List<SlaJob> findByStatus(String status);
}
