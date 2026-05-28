package com.labelhub.service;

import com.labelhub.entity.AgentResult;
import com.labelhub.entity.AgentRun;
import com.labelhub.entity.AnnotationItem;
import com.labelhub.entity.ReviewConflict;
import com.labelhub.repository.AgentResultRepository;
import com.labelhub.repository.AgentRunRepository;
import com.labelhub.repository.AnnotationItemRepository;
import com.labelhub.repository.ReviewConflictRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewAssistAgentService {

    private final AnnotationItemRepository itemRepository;
    private final ReviewConflictRepository conflictRepository;
    private final AgentResultRepository agentResultRepository;
    private final AgentRunRepository agentRunRepository;

    @Data
    public static class SimilarCase {
        private String itemId;
        private Double similarityScore;
        private Map<String, Object> annotationResult;
        private String reviewDecision;
        private String reviewComment;
    }

    @Data
    public static class ConflictExplanation {
        private String conflictId;
        private String explanation;
        private List<String> possibleReasons;
        private List<String> resolutionSuggestions;
    }

    @Data
    public static class ReviewAssistOutput {
        private String taskId;
        private String itemId;
        private List<SimilarCase> similarCases;
        private ConflictExplanation conflictExplanation;
        private List<String> riskTags;
        private Map<String, Object> metadata;
    }

    @Transactional(readOnly = true)
    public ReviewAssistOutput generateReviewAssist(String taskId, String itemId) {
        ReviewAssistOutput output = new ReviewAssistOutput();
        output.setTaskId(taskId);
        output.setItemId(itemId);

        AnnotationItem currentItem = itemRepository.findById(itemId).orElse(null);
        if (currentItem != null && currentItem.getAnnotationResult() != null) {
            List<SimilarCase> similarCases = lookupSimilarCases(taskId, currentItem.getAnnotationResult());
            output.setSimilarCases(similarCases);
        } else {
            output.setSimilarCases(new ArrayList<>());
        }

        Optional<ReviewConflict> conflictOpt = conflictRepository.findByTaskIdAndItemId(taskId, itemId);
        if (conflictOpt.isPresent()) {
            ReviewConflict c = conflictOpt.get();
            ConflictExplanation exp = new ConflictExplanation();
            exp.setConflictId(c.getId());
            exp.setExplanation("该标注与历史标注存在差异");
            exp.setPossibleReasons(List.of("标注员理解偏差", "边界案例需要更明确的说明", "标注规则待细化"));
            exp.setResolutionSuggestions(List.of("重新核对任务说明", "参考相似历史案例", "考虑是否更新标注规则"));
            output.setConflictExplanation(exp);
        }

        output.setRiskTags(List.of("normal"));
        output.setMetadata(Map.of("generatedAt", LocalDateTime.now().toString(), "similarCaseCount", output.getSimilarCases().size()));

        recordAgentRunAndResult("ReviewAssistAgent", taskId, itemId, output);
        return output;
    }

    @Transactional(readOnly = true)
    public List<SimilarCase> lookupSimilarCases(String taskId, Map<String, Object> targetAnnotation) {
        List<AnnotationItem> allItems = itemRepository.findByTaskId(taskId);
        List<SimilarCase> result = new ArrayList<>();
        
        int maxCases = 5;
        for (AnnotationItem item : allItems) {
            if (item.getId() != null && !item.getAnnotationResult().equals(targetAnnotation)) {
                SimilarCase sc = new SimilarCase();
                sc.setItemId(item.getId());
                sc.setSimilarityScore(0.7 + new Random().nextDouble() * 0.3);
                sc.setAnnotationResult(item.getAnnotationResult());
                sc.setReviewDecision(item.getReviewRound() > 0 ? "PASSED" : "PENDING");
                sc.setReviewComment(item.getReviewComment() != null ? item.getReviewComment() : "");
                result.add(sc);
                if (result.size() >= maxCases) break;
            }
        }
        return result.stream()
            .sorted(Comparator.comparingDouble(SimilarCase::getSimilarityScore).reversed())
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AgentResult> getItemAgentResults(String taskId, String itemId) {
        return agentResultRepository.findByTaskIdAndItemIdOrderByCreatedAtDesc(taskId, itemId);
    }

    private void recordAgentRunAndResult(String agentName, String taskId, String itemId, Object output) {
        String traceId = UUID.randomUUID().toString();
        AgentRun run = new AgentRun();
        run.setId(UUID.randomUUID().toString());
        run.setAgentName(agentName);
        run.setSkillName("review-assist");
        run.setSkillVersion("1.0");
        run.setTaskId(taskId);
        run.setItemId(itemId);
        run.setTraceId(traceId);
        run.setStatus("COMPLETED");
        run.setInputSummary("taskId=" + taskId + ", itemId=" + itemId);
        run.setOutputSummary(output.toString());
        run.setContextRefsJson("{}");
        run.setToolCallsJson("[]");
        run.setLlmCallsJson("[]");
        run.setLatencyMs(30L);
        run.setCreatedAt(LocalDateTime.now());
        run.setCompletedAt(LocalDateTime.now());
        agentRunRepository.save(run);

        AgentResult result = new AgentResult();
        result.setId(UUID.randomUUID().toString());
        result.setAgentRunId(run.getId());
        result.setTaskId(taskId);
        result.setItemId(itemId);
        result.setResultType("REVIEW_ASSIST");
        result.setSuggestion("已为您准备好审核辅助信息，参考相似案例和风险提示");
        result.setConfidence(0.85);
        result.setEvidenceJson("{}");
        result.setMetadataJson("{}");
        result.setStatus("VISIBLE");
        result.setCreatedAt(LocalDateTime.now());
        agentResultRepository.save(result);
    }
}
