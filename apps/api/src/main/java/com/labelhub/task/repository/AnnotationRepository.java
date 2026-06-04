package com.labelhub.task.repository;

import com.labelhub.task.entity.Annotation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnnotationRepository extends JpaRepository<Annotation, String> {
    List<Annotation> findByItemId(String itemId);
}
