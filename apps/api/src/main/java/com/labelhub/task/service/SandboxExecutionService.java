package com.labelhub.task.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class SandboxExecutionService {
    private static final Logger log = LoggerFactory.getLogger(SandboxExecutionService.class);

    private final JdbcTemplate jdbc;

    public SandboxExecutionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record SandboxResult(
        String toolName, String status, int exitCode, List<String> findings, long durationMs, String stdout,
        Map<String, Object> inputPreview, Map<String, Object> outputPreview
    ) {}

    public SandboxResult executeSchemaCheck(String traceId, List<Map<String, Object>> components) {
        long start = System.currentTimeMillis();
        List<String> findings = new ArrayList<>();
        int exitCode = 0;

        Set<String> validTypes = Set.of("shortText", "longText", "singleChoice", "multiChoice", "tagSelect", "richText", "fileUpload", "jsonEditor", "llmInteraction", "showItem");

        for (var comp : components) {
            String type = String.valueOf(comp.getOrDefault("type", ""));
            String label = String.valueOf(comp.getOrDefault("label", ""));
            String dataPath = String.valueOf(comp.getOrDefault("dataPath", ""));

            if (!validTypes.contains(type)) {
                findings.add("组件「" + label + "」类型「" + type + "」不在允许列表中");
                exitCode = 1;
            }
            if (!dataPath.startsWith("$.")) {
                findings.add("组件「" + label + "」dataPath 必须以 $. 开头");
                exitCode = 1;
            }
            if (comp.get("id") == null || comp.get("id").toString().isBlank()) {
                findings.add("组件「" + label + "」缺少 id 字段");
                exitCode = 1;
            }
        }

        long duration = System.currentTimeMillis() - start;
        String status = exitCode == 0 ? "success" : "warning";
        String stdout = findings.isEmpty() ? "All schema components valid" : String.join("\n", findings);

        persistExecution(traceId, "schema_contract_checker", exitCode, stdout, "", duration, status);
        Map<String, Object> inputPreview = Map.of(
            "checkTarget", "schemaComponents",
            "componentCount", components.size(),
            "componentIds", components.stream().map(c -> String.valueOf(c.getOrDefault("id", "?"))).limit(8).toList()
        );
        Map<String, Object> outputPreview = new LinkedHashMap<>();
        outputPreview.put("exitCode", exitCode);
        outputPreview.put("findings", findings);
        outputPreview.put("stdoutPreview", stdout.length() > 200 ? stdout.substring(0, 200) + "…" : stdout);
        return new SandboxResult("schema_contract_checker", status, exitCode, findings, duration, stdout, inputPreview, outputPreview);
    }

    public SandboxResult executeRubricCheck(String traceId, List<Map<String, Object>> rules, List<String> dimensions) {
        long start = System.currentTimeMillis();
        List<String> findings = new ArrayList<>();
        int exitCode = 0;

        Set<String> validSeverities = Set.of("low", "medium", "high", "critical");

        for (var rule : rules) {
            String severity = String.valueOf(rule.getOrDefault("severity", ""));
            String ruleId = String.valueOf(rule.getOrDefault("ruleId", ""));

            if (!validSeverities.contains(severity)) {
                findings.add("规则「" + ruleId + "」severity「" + severity + "」无效");
                exitCode = 1;
            }
            if (ruleId.isBlank()) {
                findings.add("存在缺少 ruleId 的质检规则");
                exitCode = 1;
            }
        }

        if (dimensions.size() < 4) {
            findings.add("评分维度不足 4 个（当前 " + dimensions.size() + " 个）");
        }

        long duration = System.currentTimeMillis() - start;
        String status = exitCode == 0 ? "success" : "warning";
        String stdout = findings.isEmpty() ? "All rubric rules valid" : String.join("\n", findings);

        persistExecution(traceId, "rubric_contract_checker", exitCode, stdout, "", duration, status);
        Map<String, Object> inputPreview = Map.of(
            "checkTarget", "rubricRules",
            "ruleCount", rules.size(),
            "ruleIds", rules.stream().map(r -> String.valueOf(r.getOrDefault("ruleId", "?"))).limit(8).toList(),
            "dimensionCount", dimensions.size(),
            "dimensions", dimensions.stream().limit(6).toList()
        );
        Map<String, Object> outputPreview = new LinkedHashMap<>();
        outputPreview.put("exitCode", exitCode);
        outputPreview.put("findings", findings);
        outputPreview.put("stdoutPreview", stdout.length() > 200 ? stdout.substring(0, 200) + "…" : stdout);
        return new SandboxResult("rubric_contract_checker", status, exitCode, findings, duration, stdout, inputPreview, outputPreview);
    }

    public SandboxResult executeDatasetCheck(String traceId, List<Map<String, Object>> sampleData) {
        long start = System.currentTimeMillis();
        List<String> findings = new ArrayList<>();
        int exitCode = 0;

        if (sampleData.isEmpty()) {
            findings.add("数据集为空");
            exitCode = 1;
        } else {
            Set<String> allKeys = new HashSet<>();
            for (var row : sampleData) allKeys.addAll(row.keySet());

            int emptyCount = 0;
            for (var row : sampleData) {
                for (String key : allKeys) {
                    Object val = row.get(key);
                    if (val == null || val.toString().isBlank()) emptyCount++;
                }
            }
            if (emptyCount > 0) {
                findings.add("存在 " + emptyCount + " 个空字段值");
            }

            Set<String> duplicates = new HashSet<>();
            Set<String> seen = new HashSet<>();
            for (var row : sampleData) {
                String key = row.toString();
                if (!seen.add(key)) duplicates.add(key.substring(0, Math.min(50, key.length())));
            }
            if (!duplicates.isEmpty()) {
                findings.add("存在 " + duplicates.size() + " 条重复数据");
                exitCode = 1;
            }
        }

        long duration = System.currentTimeMillis() - start;
        String status = exitCode == 0 ? "success" : "warning";
        String stdout = findings.isEmpty() ? "Dataset validation passed" : String.join("\n", findings);

        persistExecution(traceId, "dataset_profile_checker", exitCode, stdout, "", duration, status);
        List<String> fieldNames = new ArrayList<>();
        if (!sampleData.isEmpty()) {
            Set<String> keys = new LinkedHashSet<>();
            for (var row : sampleData) keys.addAll(row.keySet());
            fieldNames.addAll(keys.stream().limit(8).toList());
        }
        Map<String, Object> inputPreview = Map.of(
            "checkTarget", "sampleData",
            "rowCount", sampleData.size(),
            "fields", fieldNames,
            "samplePreview", sampleData.stream().limit(2).map(r -> {
                Map<String, Object> preview = new LinkedHashMap<>();
                r.forEach((k, v) -> preview.put(k, v != null && v.toString().length() > 60 ? v.toString().substring(0, 60) + "…" : v));
                return preview;
            }).toList()
        );
        Map<String, Object> outputPreview = new LinkedHashMap<>();
        outputPreview.put("exitCode", exitCode);
        outputPreview.put("findings", findings);
        outputPreview.put("stdoutPreview", stdout.length() > 200 ? stdout.substring(0, 200) + "…" : stdout);
        return new SandboxResult("dataset_profile_checker", status, exitCode, findings, duration, stdout, inputPreview, outputPreview);
    }

    public SandboxResult executePromptBudgetCheck(String traceId, String prompt, int ragChunkCount) {
        long start = System.currentTimeMillis();
        List<String> findings = new ArrayList<>();
        int exitCode = 0;

        if (prompt != null && prompt.length() > 8000) {
            findings.add("Prompt 长度超过 8000 字符（当前 " + prompt.length() + "）");
            exitCode = 1;
        }
        if (ragChunkCount > 10) {
            findings.add("RAG chunk 数量过多（" + ragChunkCount + "），可能导致响应变慢");
        }

        long duration = System.currentTimeMillis() - start;
        String status = exitCode == 0 ? "success" : "warning";
        String stdout = findings.isEmpty() ? "Prompt budget within limits" : String.join("\n", findings);

        persistExecution(traceId, "prompt_budget_checker", exitCode, stdout, "", duration, status);
        Map<String, Object> inputPreview = Map.of(
            "checkTarget", "promptBudget",
            "promptLength", prompt != null ? prompt.length() : 0,
            "ragChunkCount", ragChunkCount
        );
        Map<String, Object> outputPreview = Map.of(
            "exitCode", exitCode,
            "findings", findings,
            "stdoutPreview", stdout.length() > 200 ? stdout.substring(0, 200) + "…" : stdout
        );
        return new SandboxResult("prompt_budget_checker", status, exitCode, findings, duration, stdout, inputPreview, outputPreview);
    }

    public SandboxResult executePackageCheck(String traceId, Map<String, Object> taskPackage) {
        long start = System.currentTimeMillis();
        List<String> findings = new ArrayList<>();
        int exitCode = 0;

        List<String> requiredFields = List.of("taskId", "taskName", "instruction", "schemaComponents", "rubricRules");
        for (String field : requiredFields) {
            if (!taskPackage.containsKey(field) || taskPackage.get(field) == null) {
                findings.add("任务包缺少必要字段「" + field + "」");
                exitCode = 1;
            }
        }

        long duration = System.currentTimeMillis() - start;
        String status = exitCode == 0 ? "success" : "warning";
        String stdout = findings.isEmpty() ? "Package export check passed" : String.join("\n", findings);

        persistExecution(traceId, "package_export_checker", exitCode, stdout, "", duration, status);
        Map<String, Object> inputPreview = Map.of(
            "checkTarget", "taskPackage",
            "taskId", String.valueOf(taskPackage.getOrDefault("taskId", "")),
            "taskName", String.valueOf(taskPackage.getOrDefault("taskName", "")),
            "schemaComponentCount", taskPackage.get("schemaComponents") instanceof List<?> sc ? sc.size() : 0,
            "rubricRuleCount", taskPackage.get("rubricRules") instanceof List<?> rr ? rr.size() : 0
        );
        Map<String, Object> outputPreview = new LinkedHashMap<>();
        outputPreview.put("exitCode", exitCode);
        outputPreview.put("findings", findings);
        outputPreview.put("stdoutPreview", stdout.length() > 200 ? stdout.substring(0, 200) + "…" : stdout);
        return new SandboxResult("package_export_checker", status, exitCode, findings, duration, stdout, inputPreview, outputPreview);
    }

    private void persistExecution(String traceId, String toolName, int exitCode, String stdout, String stderr, long durationMs, String status) {
        String id = "sbx_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            jdbc.update(
                "INSERT INTO sandbox_executions (id, trace_id, tool_name, exit_code, stdout, stderr, duration_ms, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id, traceId, toolName, exitCode, stdout, stderr, durationMs, status
            );
        } catch (Exception e) {
            log.warn("Failed to persist sandbox execution: {}", e.getMessage());
        }
    }
}
