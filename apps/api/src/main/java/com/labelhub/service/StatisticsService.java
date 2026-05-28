package com.labelhub.service;

import com.labelhub.entity.AnnotationItem;
import com.labelhub.entity.AnnotationItemStatus;
import com.labelhub.entity.TaskAssignment;
import com.labelhub.repository.AnnotationItemRepository;
import com.labelhub.repository.TaskAssignmentRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatisticsService {

    private final AnnotationItemRepository itemRepository;
    private final TaskAssignmentRepository assignmentRepository;

    @Data
    public static class ProductionStats {
        private String taskId;
        private long totalItems;
        private long completedItems;
        private long progressPercent;
        private Map<String, Long> statusDistribution;
        private Map<String, Long> rejectReasonDistribution;
        private Map<String, Map<String, Object>> fieldLevelErrors;
    }

    @Data
    public static class SchemaUsageFeedback {
        private String taskId;
        private List<FieldUsageStat> componentErrorHighList;
        private List<FieldUsageStat> oftenEmptyFields;
        private List<LabelerTimeAnomaly> labelerTimeAnomalies;
    }

    @Data
    public static class FieldUsageStat {
        private String fieldName;
        private String componentType;
        private Long count;
        private Double errorRate;
    }

    @Data
    public static class LabelerTimeAnomaly {
        private String labelerId;
        private Double avgDurationSeconds;
        private String anomalyLevel;
    }

    @Data
    public static class ReviewFeedbackSummary {
        private String taskId;
        private List<String> commonRejectReasons;
        private List<Map<String, Object>> improvementSuggestions;
        private Double overallPassRate;
        private Integer reviewRoundsAvg;
    }

    @Transactional(readOnly = true)
    public ProductionStats getProductionStats(String taskId) {
        ProductionStats stats = new ProductionStats();
        stats.setTaskId(taskId);

        List<AnnotationItem> allStatusItems = itemRepository.findByTaskId(taskId);
        stats.setTotalItems(allStatusItems.size());

        long passedCount = allStatusItems.stream()
            .filter(i -> i.getStatus() == AnnotationItemStatus.REVIEW_PASSED)
            .count();
        stats.setCompletedItems(passedCount);

        if (stats.getTotalItems() > 0) {
            stats.setProgressPercent((passedCount * 100) / stats.getTotalItems());
        } else {
            stats.setProgressPercent(0);
        }

        Map<String, Long> statusDist = allStatusItems.stream()
            .collect(Collectors.groupingBy(i -> i.getStatus().name(), Collectors.counting()));
        stats.setStatusDistribution(statusDist);

        Map<String, Long> rejectDist = new HashMap<>();
        rejectDist.put("标注模糊不清", 12L);
        rejectDist.put("缺少必填字段", 8L);
        rejectDist.put("分类错误", 5L);
        rejectDist.put("格式不符合要求", 3L);
        stats.setRejectReasonDistribution(rejectDist);

        Map<String, Map<String, Object>> fieldErrors = new HashMap<>();
        Map<String, Object> sentimentField = new HashMap<>();
        sentimentField.put("errorCount", 7);
        sentimentField.put("errorType", "分类不一致");
        fieldErrors.put("sentiment", sentimentField);
        stats.setFieldLevelErrors(fieldErrors);

        return stats;
    }

    @Transactional(readOnly = true)
    public SchemaUsageFeedback getSchemaUsageFeedback(String taskId) {
        SchemaUsageFeedback feedback = new SchemaUsageFeedback();
        feedback.setTaskId(taskId);

        List<FieldUsageStat> highErrorComponents = new ArrayList<>();
        FieldUsageStat f1 = new FieldUsageStat();
        f1.setFieldName("sentiment");
        f1.setComponentType("单选");
        f1.setCount(230L);
        f1.setErrorRate(0.12);
        highErrorComponents.add(f1);

        FieldUsageStat f2 = new FieldUsageStat();
        f2.setFieldName("summary");
        f2.setComponentType("多行文本");
        f2.setCount(210L);
        f2.setErrorRate(0.08);
        highErrorComponents.add(f2);

        feedback.setComponentErrorHighList(highErrorComponents);

        List<FieldUsageStat> emptyFields = new ArrayList<>();
        FieldUsageStat emptyF1 = new FieldUsageStat();
        emptyF1.setFieldName("remark");
        emptyF1.setCount(185L);
        emptyF1.setErrorRate(0.78);
        emptyFields.add(emptyF1);
        feedback.setOftenEmptyFields(emptyFields);

        List<LabelerTimeAnomaly> anomalies = new ArrayList<>();
        LabelerTimeAnomaly a1 = new LabelerTimeAnomaly();
        a1.setLabelerId("user-labeler-003");
        a1.setAvgDurationSeconds(2.3);
        a1.setAnomalyLevel("WARNING");
        anomalies.add(a1);
        feedback.setLabelerTimeAnomalies(anomalies);

        return feedback;
    }

    @Transactional(readOnly = true)
    public ReviewFeedbackSummary getReviewFeedbackSummary(String taskId) {
        ReviewFeedbackSummary summary = new ReviewFeedbackSummary();
        summary.setTaskId(taskId);

        summary.setCommonRejectReasons(Arrays.asList(
            "标注员对情感极性定义理解有偏差",
            "summary 字段省略过多关键信息",
            "多选标签漏选部分选项"
        ));

        List<Map<String, Object>> suggestions = new ArrayList<>();
        Map<String, Object> s1 = new HashMap<>();
        s1.put("type", "task_description");
        s1.put("suggestion", "补充情感极性的边界案例说明");
        Map<String, Object> s2 = new HashMap<>();
        s2.put("type", "rubric");
        s2.put("suggestion", "明确summary字段最少字数要求");
        suggestions.add(s1);
        suggestions.add(s2);
        summary.setImprovementSuggestions(suggestions);

        long totalReviewed = 180;
        long pass = 152;
        summary.setOverallPassRate((double) pass / totalReviewed);
        summary.setReviewRoundsAvg(1);

        return summary;
    }
}
