package com.labelhub.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewerCoachAgentService {

    public List<CoachingTip> getCoachingTips(String reviewerId) {
        return List.of(
            new CoachingTip("tip-1", "最近1小时审核通过率为 87%，建议关注边缘案例"),
            new CoachingTip("tip-2", "该类任务的平均审核时长为 15秒，您当前为 22秒")
        );
    }

    public record CoachingTip(String id, String tipText) {}
}
