package com.labelhub.repository;

import com.labelhub.entity.AnnotationDraft;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnnotationDraftRepository extends JpaRepository<AnnotationDraft, String> {
    List<AnnotationDraft> findByItemIdAndLabelerId(String itemId, String labelerId);
    Optional<AnnotationDraft> findFirstByItemIdAndLabelerIdOrderBySavedAtDesc(String itemId, String labelerId);
}
