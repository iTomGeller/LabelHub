package com.labelhub.task.repository;

import com.labelhub.task.entity.AnnotationDraft;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AnnotationDraftRepository extends JpaRepository<AnnotationDraft, String> {
    Optional<AnnotationDraft> findByItemIdAndLabelerId(String itemId, String labelerId);
}
