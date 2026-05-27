package com.labelhub.task.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SkillRegistryService {
    private static final Logger log = LoggerFactory.getLogger(SkillRegistryService.class);

    private final JdbcTemplate jdbc;
    private final String skillsDir;
    private final List<SkillMeta> skills = new ArrayList<>();

    public SkillRegistryService(JdbcTemplate jdbc, @Value("${labelhub.skills-dir:skills}") String skillsDir) {
        this.jdbc = jdbc;
        this.skillsDir = skillsDir;
    }

    public record SkillMeta(String id, String name, String version, String description, List<String> triggers, String rules, String filePath) {}
    public record SkillFinding(String skillName, String severity, String description, String evidence, String suggestion) {}
    public record SkillExecutionResult(
        String skillName, String status, List<SkillFinding> findings, long durationMs,
        Map<String, Object> inputPreview, Map<String, Object> outputPreview, String whyCalled
    ) {}

    @PostConstruct
    public void scanSkills() {
        Path dir = Path.of(skillsDir);
        if (!Files.exists(dir)) {
            log.warn("Skills directory not found: {}", skillsDir);
            return;
        }

        try (var stream = Files.list(dir)) {
            stream.filter(p -> p.toString().endsWith(".md")).forEach(this::parseSkillFile);
        } catch (IOException e) {
            log.error("Failed to scan skills directory: {}", e.getMessage());
        }

        log.info("Loaded {} skills from {}", skills.size(), skillsDir);

        for (SkillMeta skill : skills) {
            jdbc.update(
                "INSERT INTO skill_registry (id, name, version, description, triggers_json, file_path, active) VALUES (?, ?, ?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE version=VALUES(version), description=VALUES(description), triggers_json=VALUES(triggers_json)",
                skill.id(), skill.name(), skill.version(), skill.description(),
                "[\"" + String.join("\",\"", skill.triggers()) + "\"]", skill.filePath()
            );
        }
    }

    public List<SkillMeta> getSkillsForNode(String auditNode) {
        return skills.stream()
            .filter(s -> s.triggers().contains(auditNode) || s.triggers().contains("*"))
            .toList();
    }

    public SkillExecutionResult executeSkill(SkillMeta skill, Map<String, Object> context) {
        long start = System.currentTimeMillis();
        List<SkillFinding> findings = new ArrayList<>();

        String taskName = String.valueOf(context.getOrDefault("taskName", ""));
        String instruction = String.valueOf(context.getOrDefault("instruction", ""));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> components = (List<Map<String, Object>>) context.getOrDefault("schemaComponents", List.of());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rules = (List<Map<String, Object>>) context.getOrDefault("rubricRules", List.of());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sampleData = (List<Map<String, Object>>) context.getOrDefault("sampleData", List.of());

        switch (skill.name()) {
            case "task-schema-builder" -> {
                if (components.isEmpty()) {
                    findings.add(new SkillFinding(skill.name(), "high", "缺少标注模板组件", "当前配置中没有任何标注组件", "请在步骤2配置至少一个标注组件"));
                }
                for (var comp : components) {
                    String dataPath = String.valueOf(comp.getOrDefault("dataPath", ""));
                    if (!dataPath.startsWith("$.")) {
                        findings.add(new SkillFinding(skill.name(), "medium", "dataPath 格式不规范", "组件「" + comp.get("label") + "」的 dataPath 应以 $. 开头", "修改为 $. 前缀"));
                    }
                    @SuppressWarnings("unchecked")
                    List<Object> validation = (List<Object>) comp.getOrDefault("validation", List.of());
                    boolean isRequired = Boolean.TRUE.equals(comp.get("required"));
                    if (isRequired && validation.isEmpty()) {
                        findings.add(new SkillFinding(skill.name(), "medium", "必填组件缺少校验规则", "组件「" + comp.get("label") + "」标记为必填但没有 validation", "添加 required 类型的校验规则"));
                    }
                }
            }
            case "instruction-refine" -> {
                if (instruction.isBlank()) {
                    findings.add(new SkillFinding(skill.name(), "high", "任务说明为空", "未填写任务说明", "补充清晰的标注目标和判断标准"));
                } else if (instruction.length() < 20) {
                    findings.add(new SkillFinding(skill.name(), "medium", "任务说明过短", "当前仅 " + instruction.length() + " 字", "建议至少 50 字，包含标注目标和边界情况"));
                }
                if (!instruction.contains("标注") && !instruction.contains("分类") && !instruction.contains("判断")) {
                    findings.add(new SkillFinding(skill.name(), "low", "任务说明缺少标注动作词", "建议包含明确的标注动作描述", "使用\"标注\"、\"分类\"、\"判断\"等动作词"));
                }
            }
            case "dataset-profile" -> {
                if (sampleData.isEmpty()) {
                    findings.add(new SkillFinding(skill.name(), "high", "缺少样例数据", "未提供任何样例数据", "上传或生成至少 3 条样例数据"));
                } else {
                    Set<String> allFields = new HashSet<>();
                    for (var row : sampleData) allFields.addAll(row.keySet());
                    for (var row : sampleData) {
                        for (String field : allFields) {
                            Object val = row.get(field);
                            if (val == null || val.toString().isBlank()) {
                                findings.add(new SkillFinding(skill.name(), "low", "存在空字段", "字段「" + field + "」在部分数据中为空", "补充完整或移除不必要字段"));
                                break;
                            }
                        }
                    }
                    if (sampleData.size() < 3) {
                        findings.add(new SkillFinding(skill.name(), "medium", "样例数据不足", "当前仅 " + sampleData.size() + " 条", "建议至少提供 3-5 条覆盖不同场景的样例"));
                    }
                }
            }
            case "design-enterprise" -> {
                if (rules.isEmpty()) {
                    findings.add(new SkillFinding(skill.name(), "high", "缺少质检规则", "未定义任何质检规则", "请在步骤3添加质检规则"));
                }
                Set<String> severities = rules.stream().map(r -> String.valueOf(r.getOrDefault("severity", ""))).collect(Collectors.toSet());
                if (!severities.contains("high") && !severities.contains("critical")) {
                    findings.add(new SkillFinding(skill.name(), "medium", "缺少高优先级规则", "所有规则均为低/中优先级", "建议添加至少一条 high 或 critical 级别规则"));
                }
            }
        }

        long duration = System.currentTimeMillis() - start;
        String status = findings.stream().anyMatch(f -> "high".equals(f.severity()) || "critical".equals(f.severity())) ? "warning" : "success";

        Map<String, Object> inputPreview = new LinkedHashMap<>();
        inputPreview.put("skillName", skill.name());
        inputPreview.put("taskName", taskName);
        inputPreview.put("instructionPreview", instruction.length() > 120 ? instruction.substring(0, 120) + "…" : instruction);
        inputPreview.put("componentCount", components.size());
        inputPreview.put("ruleCount", rules.size());
        inputPreview.put("sampleCount", sampleData.size());

        Map<String, Object> outputPreview = new LinkedHashMap<>();
        outputPreview.put("findingCount", findings.size());
        outputPreview.put("findings", findings.stream().map(f -> Map.of(
            "severity", f.severity(),
            "description", f.description(),
            "suggestion", f.suggestion() != null ? f.suggestion() : ""
        )).toList());
        outputPreview.put("status", status);

        String whyCalled = switch (skill.name()) {
            case "instruction-refine" -> "检查任务说明是否包含标注目标与边界说明";
            case "task-schema-builder" -> "校验标注组件 dataPath 与必填校验规则";
            case "dataset-profile" -> "分析样例数据字段覆盖与空值分布";
            case "design-enterprise" -> "检查质检规则严重级别与维度覆盖";
            default -> "执行技能「" + skill.name() + "」进行静态规则检查";
        };

        return new SkillExecutionResult(skill.name(), status, findings, duration, inputPreview, outputPreview, whyCalled);
    }

    public List<SkillMeta> getAllSkills() {
        return Collections.unmodifiableList(skills);
    }

    private void parseSkillFile(Path path) {
        try {
            String content = Files.readString(path);
            String name = extractField(content, "name");
            if (name.isEmpty()) name = path.getFileName().toString().replace(".md", "");
            String version = extractField(content, "version");
            if (version.isEmpty()) version = "0.1.0";
            String description = extractField(content, "description");
            List<String> triggers = parseTriggers(content);
            String rules = extractSection(content, "Rules");
            if (rules.isEmpty()) rules = extractSection(content, "Checks");

            String id = "skill_" + name.replace("-", "_");
            skills.add(new SkillMeta(id, name, version, description, triggers, rules, path.toString()));
        } catch (IOException e) {
            log.warn("Failed to parse skill file {}: {}", path, e.getMessage());
        }
    }

    private String extractField(String content, String field) {
        for (String line : content.split("\n")) {
            if (line.startsWith(field + ":")) {
                return line.substring(field.length() + 1).trim().replaceAll("^\"|\"$", "");
            }
        }
        return "";
    }

    private List<String> parseTriggers(String content) {
        List<String> triggers = new ArrayList<>();
        boolean inTriggers = false;
        for (String line : content.split("\n")) {
            if (line.startsWith("triggers:")) { inTriggers = true; continue; }
            if (inTriggers) {
                if (line.startsWith("  - ")) {
                    triggers.add(line.substring(4).trim());
                } else if (!line.startsWith(" ")) {
                    break;
                }
            }
        }
        if (triggers.isEmpty()) triggers.add("*");
        return triggers;
    }

    private String extractSection(String content, String header) {
        String[] lines = content.split("\n");
        StringBuilder section = new StringBuilder();
        boolean capturing = false;
        for (String line : lines) {
            if (line.startsWith("## " + header)) { capturing = true; continue; }
            if (capturing && line.startsWith("## ")) break;
            if (capturing) section.append(line).append("\n");
        }
        return section.toString().trim();
    }
}
