package com.labelhub.repository;

import com.labelhub.entity.ReviewDecision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReviewDecisionRepository extends JpaRepository<ReviewDecision, String> {
    List<ReviewDecision> findByReviewId(String reviewId);
}
