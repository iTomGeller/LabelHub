package com.labelhub.repository;

import com.labelhub.entity.Annotation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnnotationRepository extends JpaRepository<Annotation, String> {
    List<Annotation> findByItemId(String itemId);
    List<Annotation> findByLabelerId(String labelerId);
    List<Annotation> findByItemIdAndLabelerId(String itemId, String labelerId);
}
