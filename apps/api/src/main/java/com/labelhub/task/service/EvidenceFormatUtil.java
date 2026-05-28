package com.labelhub.task.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Shared formatting for user-facing evidence items (non-technical). */
final class EvidenceFormatUtil {

    private EvidenceFormatUtil() {}

    static String componentRoleZh(String type) {
        if (type == null || type.isBlank()) return "组件";
        return switch (type) {
            case "showItem" -> "原文展示";
            case "singleChoice" -> "单选标注";
            case "multiChoice" -> "多选标注";
            case "shortText" -> "短文本标注";
            case "longText" -> "长文本标注";
            case "number" -> "数字标注";
            case "boolean" -> "布尔标注";
            default -> "组件";
        };
    }

    static String severityZh(String severity) {
        if (severity == null) return "未知";
        return switch (severity.toLowerCase()) {
            case "high" -> "高";
            case "medium" -> "中";
            case "low" -> "低";
            default -> "未知";
        };
    }

    static Map<String, Object> componentEvidenceItem(Map<String, Object> c) {
        String typeRaw = String.valueOf(c.getOrDefault("type", ""));
        boolean required = Boolean.TRUE.equals(c.getOrDefault("required", false));
        int validationCount = c.get("validation") instanceof List<?> v ? v.size() : 0;
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("type", "component");
        item.put("label", String.valueOf(c.getOrDefault("label", c.getOrDefault("id", "?"))));
        item.put("role", componentRoleZh(typeRaw));
        item.put("requirement", required ? "必填" : "可选");
        item.put("validationCount", validationCount);
        item.put("fieldPath", String.valueOf(c.getOrDefault("dataPath", "")));
        item.put("source", "schemaComponents");
        return item;
    }

    static List<Map<String, Object>> schemaComponentEvidence(List<Map<String, Object>> components) {
        if (components == null || components.isEmpty()) return List.of();
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> c : components) {
            items.add(componentEvidenceItem(c));
        }
        return items;
    }
}
