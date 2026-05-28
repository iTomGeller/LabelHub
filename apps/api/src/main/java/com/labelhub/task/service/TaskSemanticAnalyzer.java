package com.labelhub.task.service;

import java.util.*;
import java.util.stream.Collectors;

/** Task-specific business evidence for audit nodes (客服情感分类等). */
public final class TaskSemanticAnalyzer {
    private TaskSemanticAnalyzer() {}

    public static boolean isSentimentClassificationTask(AgentRunService.AuditRequest request) {
        if (request == null) return false;
        if ("task_text_cls_001".equals(request.taskId())) return true;
        String name = request.taskName() != null ? request.taskName() : "";
        String instruction = request.instruction() != null ? request.instruction() : "";
        return name.contains("情感") || instruction.contains("情感倾向");
    }

    public static List<Map<String, Object>> instructionEvidence(AgentRunService.AuditRequest request) {
        if (!isSentimentClassificationTask(request)) return List.of();
        List<Map<String, Object>> items = new ArrayList<>();
        String instruction = request.instruction() != null ? request.instruction() : "";
        items.add(Map.of("type", "category", "label", "情感类别定义", "value", "正面/负面/中性/混合", "source", "instruction"));
        if (instruction.contains("关键句")) {
            items.add(Map.of("type", "field", "label", "触发关键句", "value", "须引用对话原文", "source", "instruction"));
        }
        if (instruction.contains("理由")) {
            items.add(Map.of("type", "field", "label", "判断理由", "value", "须说明判定依据", "source", "instruction"));
        }
        items.add(Map.of("type", "task", "label", "任务类型", "value", "客服对话情感分类", "source", "taskName"));
        return items;
    }

    public static List<Map<String, Object>> sampleCoverageEvidence(List<Map<String, Object>> sampleData) {
        if (sampleData == null || sampleData.isEmpty()) return List.of();
        int positive = 0, negative = 0, neutral = 0, consult = 0;
        for (Map<String, Object> row : sampleData) {
            String text = extractDialogue(row).toLowerCase();
            if (text.isBlank()) continue;
            if (containsAny(text, "谢谢", "满意", "五星", "很好", "解决了")) positive++;
            else if (containsAny(text, "破", "没人", "投诉", "愤怒", "垃圾", "差")) negative++;
            else if (containsAny(text, "请问", "哪里", "怎么", "咨询", "地址")) consult++;
            else neutral++;
        }
        List<Map<String, Object>> items = new ArrayList<>();
        items.add(Map.of("type", "coverage", "label", "正面样例", "value", positive, "source", "sampleData"));
        items.add(Map.of("type", "coverage", "label", "负面样例", "value", negative, "source", "sampleData"));
        items.add(Map.of("type", "coverage", "label", "中性样例", "value", neutral, "source", "sampleData"));
        items.add(Map.of("type", "coverage", "label", "咨询类样例", "value", consult, "source", "sampleData"));
        return items;
    }

    public static String sampleCoverageSummary(List<Map<String, Object>> sampleData) {
        var evidence = sampleCoverageEvidence(sampleData);
        if (evidence.isEmpty()) return "缺少样例数据";
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (var e : evidence) {
            counts.put(String.valueOf(e.get("label")), ((Number) e.get("value")).intValue());
        }
        return String.format("样例覆盖：正面 %d / 负面 %d / 中性 %d / 咨询 %d",
            counts.getOrDefault("正面样例", 0), counts.getOrDefault("负面样例", 0),
            counts.getOrDefault("中性样例", 0), counts.getOrDefault("咨询类样例", 0));
    }

    public static List<Map<String, Object>> schemaSentimentEvidence(List<Map<String, Object>> components) {
        if (components == null || components.isEmpty()) return List.of();
        Set<String> labels = components.stream()
            .map(c -> String.valueOf(c.getOrDefault("label", "")))
            .collect(Collectors.toSet());
        List<Map<String, Object>> items = new ArrayList<>();
        for (String required : List.of("情感倾向", "触发关键句", "判断理由")) {
            boolean present = labels.stream().anyMatch(l -> l.contains(required.replace("触发", "").trim()) || l.contains(required));
            items.add(Map.of("type", "checklist", "label", required, "value", present ? "已配置" : "缺失", "source", "schemaComponents", "status", present ? "ok" : "missing"));
        }
        for (Map<String, Object> c : components) {
            String label = String.valueOf(c.getOrDefault("label", ""));
            if (label.contains("情感") || label.contains("情绪") || label.contains("理由") || label.contains("关键句")) {
                Map<String, Object> item = new LinkedHashMap<>(EvidenceFormatUtil.componentEvidenceItem(c));
                item.put("status", "ok");
                items.add(item);
            }
        }
        return items;
    }

    public static String schemaSentimentSummary(List<Map<String, Object>> components) {
        long required = schemaSentimentEvidence(components).stream()
            .filter(e -> "missing".equals(String.valueOf(e.get("status"))))
            .count();
        if (components == null || components.isEmpty()) return "缺少标注模板，无法采集情感倾向与理由";
        if (required > 0) return String.format("%d 个标注组件，情感字段未齐备（情感倾向/触发关键句/判断理由）", components.size());
        return String.format("%d 个标注组件，已覆盖情感倾向、触发关键句与判断理由", components.size());
    }

    public static List<Map<String, Object>> rubricSentimentEvidence(List<Map<String, Object>> rules) {
        if (rules == null || rules.isEmpty()) return List.of();
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> r : rules) {
            items.add(Map.of(
                "type", "rule",
                "label", String.valueOf(r.getOrDefault("ruleId", "R?")),
                "value", String.valueOf(r.getOrDefault("description", "")),
                "source", "rubricRules",
                "status", r.getOrDefault("severity", "medium")
            ));
        }
        long quoteRules = rules.stream().map(r -> String.valueOf(r.getOrDefault("description", "")))
            .filter(d -> d.contains("引用") || d.contains("原文") || d.contains("臆测")).count();
        items.add(Map.of("type", "pattern", "label", "原文引用/不得臆测规则", "value", quoteRules, "source", "rubricRules"));
        return items;
    }

    public static String assessmentSentimentSummary(AgentRunService.AuditRequest request, boolean hasAll, int ragEmptyNodes, List<String> issues) {
        if (!isSentimentClassificationTask(request)) {
            return hasAll ? "上游各子项校验通过，整体可流转" : "关键检查未通过，请修复后再发";
        }
        if (!hasAll) {
            return "客服情感分类任务配置不完整：" + String.join("、", issues);
        }
        if (ragEmptyNodes >= 4) {
            return "任务可发布，但当前置信度受知识库缺失影响；建议补充标注规范后重审";
        }
        return "客服情感分类任务配置完整，情感类别、关键句与理由字段就绪，可安全发布";
    }

    private static String extractDialogue(Map<String, Object> row) {
        if (row == null) return "";
        Object dialogue = row.get("dialogue");
        if (dialogue != null) return String.valueOf(dialogue);
        return row.values().stream().map(String::valueOf).collect(Collectors.joining(" "));
    }

    private static boolean containsAny(String text, String... needles) {
        for (String n : needles) {
            if (text.contains(n)) return true;
        }
        return false;
    }
}
