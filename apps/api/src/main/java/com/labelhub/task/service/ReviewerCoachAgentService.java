package com.labelhub.task.service;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewerCoachAgentService {

    @Data
    public static class CoachingTip {
        private String tipId;
        private String reviewerId;
        private String tipType;
        private String tipContent;
        private Double priorityScore;
    }

    @Transactional(readOnly = true)
    public List<CoachingTip> getCoachingTips(String reviewerId) {
        List<CoachingTip> tips = new ArrayList<>();
        CoachingTip tip = new CoachingTip();
        tip.setTipId("tip-001");
        tip.setReviewerId(reviewerId);
        tip.setTipType("BEST_PRACTICE");
        tip.setTipContent("建议重点检查情感极性边界案例，近期该类驳回率较高");
        tip.setPriorityScore(0.85);
        tips.add(tip);
        return tips;
    }
}
