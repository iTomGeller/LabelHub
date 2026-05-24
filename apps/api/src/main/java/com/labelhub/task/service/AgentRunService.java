package com.labelhub.task.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@Service
public class AgentRunService {
    private static final Logger log = LoggerFactory.getLogger(AgentRunService.class);

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final KnowledgeBaseService knowledgeBaseService;
    private final SkillRegistryService skillRegistryService;
    private final SandboxExecutionService sandboxService;
    private final McpGatewayService mcpGateway;
    private final DeepSeekService deepSeekService;
    private final AgentMetrics agentMetrics;

    public AgentRunService(
        JdbcTemplate jdbc, ObjectMapper objectMapper,
        KnowledgeBaseService knowledgeBaseService,
        SkillRegistryService skillRegistryService,
        SandboxExecutionService sandboxService,
        McpGatewayService mcpGateway,
        DeepSeekService deepSeekService,
        AgentMetrics agentMetrics
    ) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.knowledgeBaseService = knowledgeBaseService;
        this.skillRegistryService = skillRegistryService;
        this.sandboxService = sandboxService;
        this.mcpGateway = mcpGateway;
        this.deepSeekService = deepSeekService;
        this.agentMetrics = agentMetrics;
    }

    public record AuditRequest(String taskId, String taskName, String instruction,
                               List<Map<String, Object>> sampleData,
                               List<Map<String, Object>> schemaComponents,
                               List<Map<String, Object>> rubricRules,
                               List<String> rubricDimensions,
                               boolean forceRun) {}

    public record BusinessNode(String id, String nodeKey, String title, String status,
                               String summary, String evidence, String impact,
                               String suggestion, List<String> referenceSources, String fixStep, long durationMs) {}

    public record TraceNode(String id, String type, String title, String status,
                            long durationMs, Object inputPreview, Object outputPreview,
                            Map<String, Object> prompt, Map<String, Object> rag,
                            Map<String, Object> skill, Map<String, Object> mcp,
                            Map<String, Object> sandbox, List<String> children) {}

    public record AgentRunResult(String traceId, String taskId, String configHash,
                                 String status, boolean fromCache,
                                 List<BusinessNode> businessDag,
                                 List<TraceNode> developerDag,
                                 long durationMs) {}

    public AgentRunResult executeOrReuse(AuditRequest request) {
        String configHash = computeConfigHash(request);

        if (!request.forceRun()) {
            AgentRunResult cached = findCachedRun(request.taskId(), configHash);
            if (cached != null) {
                agentMetrics.recordPipelineStage("audit_cache_hit", 0);
                log.info("Returning cached audit run for task={} hash={}", request.taskId(), configHash);
                return cached;
            }
        }

        agentMetrics.recordPipelineStage("audit_cache_miss", 0);
        return executeFullRun(request, configHash);
    }

    public AgentRunResult getRunByTraceId(String traceId) {
        var rows = jdbc.queryForList("SELECT * FROM agent_runs WHERE trace_id = ?", traceId);
        if (rows.isEmpty()) return null;
        var row = rows.get(0);
        List<BusinessNode> business = loadBusinessNodes(traceId);
        List<TraceNode> developer = loadTraceNodes(traceId);
        return new AgentRunResult(
            traceId, (String) row.get("task_id"), (String) row.get("config_hash"),
            (String) row.get("status"), Boolean.TRUE.equals(row.get("from_cache")),
            business, developer, 0
        );
    }

    public AgentRunResult findByTaskAndHash(String taskId, String configHash) {
        return findCachedRun(taskId, configHash);
    }

    private AgentRunResult executeFullRun(AuditRequest request, String configHash) {
        String traceId = "trace_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
        long runStart = System.currentTimeMillis();

        jdbc.update(
            "INSERT INTO agent_runs (trace_id, task_id, config_hash, status, from_cache) VALUES (?, ?, ?, 'running', FALSE)",
            traceId, request.taskId(), configHash
        );

        List<BusinessNode> businessNodes = new ArrayList<>();
        List<TraceNode> traceNodes = new ArrayList<>();

        // Node 1: Task Description Check
        long nodeStart = System.currentTimeMillis();
        String ragContext1 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "task_context");
        var instructionSkills = skillRegistryService.getSkillsForNode("task_context");
        Map<String, Object> skillCtx = Map.of("taskName", request.taskName(), "instruction", request.instruction(), "sampleData", request.sampleData() != null ? request.sampleData() : List.of());
        List<SkillRegistryService.SkillFinding> instrFindings = new ArrayList<>();
        for (var skill : instructionSkills) {
            var result = skillRegistryService.executeSkill(skill, skillCtx);
            instrFindings.addAll(result.findings());
        }
        long node1Duration = System.currentTimeMillis() - nodeStart;

        String instrStatus = instrFindings.stream().anyMatch(f -> "high".equals(f.severity())) ? "warning" : "success";
        String instrSummary = instrFindings.isEmpty()
            ? "任务说明清晰完整，包含明确的标注目标和判断标准"
            : instrFindings.get(0).description();
        String instrEvidence = !ragContext1.isEmpty() ? "参考知识：" + ragContext1.lines().limit(2).reduce("", (a, b) -> a + b) : "";
        String instrImpact = instrStatus.equals("warning") ? "说明不清晰可能导致标注员理解偏差" : "";
        String instrSuggestion = instrFindings.isEmpty() ? "" : instrFindings.get(0).suggestion();

        businessNodes.add(new BusinessNode("bn_1", "task_description", "任务说明", instrStatus, instrSummary, instrEvidence, instrImpact, instrSuggestion, ragContext1.isEmpty() ? List.of() : List.of("标注规范"), "upload", node1Duration));
        traceNodes.add(buildTraceNode(traceId, "tn_1", "agent", "任务说明审核", instrStatus, node1Duration, ragContext1, instructionSkills, instrFindings));

        // Node 2: Sample Data Check
        nodeStart = System.currentTimeMillis();
        String ragContext2 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "dataset_sampler");
        var dataResult = sandboxService.executeDatasetCheck(traceId, request.sampleData() != null ? request.sampleData() : List.of());
        long node2Duration = System.currentTimeMillis() - nodeStart;

        int sampleCount = request.sampleData() != null ? request.sampleData().size() : 0;
        String dataStatus = dataResult.exitCode() == 0 && sampleCount >= 3 ? "success" : "warning";
        String dataSummary = sampleCount == 0 ? "缺少样例数据" : String.format("共 %d 条样例数据，%s", sampleCount, dataResult.findings().isEmpty() ? "数据完整" : dataResult.findings().get(0));

        businessNodes.add(new BusinessNode("bn_2", "sample_data", "样例数据", dataStatus, dataSummary, ragContext2.isEmpty() ? "" : "参考数据规范", dataStatus.equals("warning") ? "数据不足可能影响 AI 生成质量" : "", dataResult.findings().isEmpty() ? "" : "补充更多样例或修复空字段", ragContext2.isEmpty() ? List.of() : List.of("数据规范"), "upload", node2Duration));
        traceNodes.add(buildTraceNode(traceId, "tn_2", "sandbox", "数据集校验", dataStatus, node2Duration, ragContext2, List.of(), List.of()));

        // Node 3: Schema Template Check
        nodeStart = System.currentTimeMillis();
        String ragContext3 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "schema_generator");
        var schemaResult = sandboxService.executeSchemaCheck(traceId, request.schemaComponents() != null ? request.schemaComponents() : List.of());
        var schemaSkills = skillRegistryService.getSkillsForNode("schema_generator");
        Map<String, Object> schemaCtx = Map.of("taskName", request.taskName(), "instruction", request.instruction(), "schemaComponents", request.schemaComponents() != null ? request.schemaComponents() : List.of());
        List<SkillRegistryService.SkillFinding> schemaFindings = new ArrayList<>();
        for (var skill : schemaSkills) {
            var sr = skillRegistryService.executeSkill(skill, schemaCtx);
            schemaFindings.addAll(sr.findings());
        }
        long node3Duration = System.currentTimeMillis() - nodeStart;

        int compCount = request.schemaComponents() != null ? request.schemaComponents().size() : 0;
        String schemaStatus = schemaResult.exitCode() == 0 && compCount > 0 && schemaFindings.stream().noneMatch(f -> "high".equals(f.severity())) ? "success" : "warning";
        String schemaSummary = compCount == 0 ? "缺少标注模板组件" : String.format("%d 个标注组件，%s", compCount, schemaResult.findings().isEmpty() ? "全部符合规范" : schemaResult.findings().get(0));

        businessNodes.add(new BusinessNode("bn_3", "annotation_template", "标注模板", schemaStatus, schemaSummary, ragContext3.isEmpty() ? "" : "参考模板规范", schemaStatus.equals("warning") ? "模板不完整会导致标注员无法正确提交" : "", schemaFindings.isEmpty() ? "" : schemaFindings.get(0).suggestion(), ragContext3.isEmpty() ? List.of() : List.of("模板规范"), "template", node3Duration));
        traceNodes.add(buildTraceNode(traceId, "tn_3", "tool", "Schema 校验", schemaStatus, node3Duration, ragContext3, schemaSkills, schemaFindings));

        // Node 4: Quality Rules Check
        nodeStart = System.currentTimeMillis();
        String ragContext4 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "rubric_generator");
        var rubricResult = sandboxService.executeRubricCheck(traceId, request.rubricRules() != null ? request.rubricRules() : List.of(), request.rubricDimensions() != null ? request.rubricDimensions() : List.of());
        long node4Duration = System.currentTimeMillis() - nodeStart;

        int ruleCount = request.rubricRules() != null ? request.rubricRules().size() : 0;
        String rubricStatus = rubricResult.exitCode() == 0 && ruleCount > 0 ? "success" : "warning";
        String rubricSummary = ruleCount == 0 ? "缺少质检规则" : String.format("%d 条质检规则，%s", ruleCount, rubricResult.findings().isEmpty() ? "规则配置完整" : rubricResult.findings().get(0));

        businessNodes.add(new BusinessNode("bn_4", "quality_rules", "质检规则", rubricStatus, rubricSummary, ragContext4.isEmpty() ? "" : "参考质检规范", rubricStatus.equals("warning") ? "缺少规则可能导致审核无标准" : "", rubricResult.findings().isEmpty() ? "" : "补充质检规则和评分维度", ragContext4.isEmpty() ? List.of() : List.of("质检规则"), "rules", node4Duration));
        traceNodes.add(buildTraceNode(traceId, "tn_4", "tool", "Rubric 校验", rubricStatus, node4Duration, ragContext4, List.of(), List.of()));

        // Node 5: Comprehensive Assessment
        nodeStart = System.currentTimeMillis();
        String ragContext5 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "critic");
        boolean hasAll = compCount > 0 && ruleCount > 0 && sampleCount >= 3;
        long node5Duration = System.currentTimeMillis() - nodeStart;

        String assessStatus = hasAll ? "success" : "warning";
        String assessSummary = hasAll ? "任务配置完整，各维度均达标" : "部分配置不完整，建议修复后再发布";
        List<String> issues = new ArrayList<>();
        if (compCount == 0) issues.add("缺少标注模板");
        if (ruleCount == 0) issues.add("缺少质检规则");
        if (sampleCount < 3) issues.add("样例不足 3 条");

        businessNodes.add(new BusinessNode("bn_5", "comprehensive_assessment", "综合评估", assessStatus, assessSummary, ragContext5.isEmpty() ? "" : "参考评分标准", hasAll ? "" : "不完整的配置可能影响标注质量和效率", issues.isEmpty() ? "" : "修复: " + String.join("、", issues), ragContext5.isEmpty() ? List.of() : List.of("项目要求"), "publish", node5Duration));
        traceNodes.add(buildTraceNode(traceId, "tn_5", "agent", "综合评估", assessStatus, node5Duration, ragContext5, List.of(), List.of()));

        // Node 6: Publish Readiness
        nodeStart = System.currentTimeMillis();
        Map<String, Object> pkg = new LinkedHashMap<>();
        pkg.put("taskId", request.taskId());
        pkg.put("taskName", request.taskName());
        pkg.put("instruction", request.instruction());
        pkg.put("schemaComponents", request.schemaComponents());
        pkg.put("rubricRules", request.rubricRules());
        var pkgResult = sandboxService.executePackageCheck(traceId, pkg);
        long node6Duration = System.currentTimeMillis() - nodeStart;

        String pkgStatus = pkgResult.exitCode() == 0 && hasAll ? "success" : "warning";
        String pkgSummary = pkgStatus.equals("success") ? "任务包可以安全发布，B/C 模块可消费" : "任务包存在缺失字段，需修复后发布";

        businessNodes.add(new BusinessNode("bn_6", "publish_readiness", "发布准备", pkgStatus, pkgSummary, "", pkgStatus.equals("warning") ? "不完整的任务包无法被 B/C 模块正确消费" : "", pkgResult.findings().isEmpty() ? "" : pkgResult.findings().get(0), List.of(), "publish", node6Duration));
        traceNodes.add(buildTraceNode(traceId, "tn_6", "tool", "任务包校验", pkgStatus, node6Duration, "", List.of(), List.of()));

        // Finalize
        long totalDuration = System.currentTimeMillis() - runStart;
        boolean allPassed = businessNodes.stream().allMatch(n -> "success".equals(n.status()));
        String overallStatus = allPassed ? "success" : "warning";

        persistBusinessNodes(traceId, businessNodes);
        persistTraceNodes(traceId, traceNodes);

        try {
            jdbc.update(
                "UPDATE agent_runs SET status = ?, finished_at = NOW(), result_json = ? WHERE trace_id = ?",
                overallStatus, objectMapper.writeValueAsString(Map.of("allPassed", allPassed, "durationMs", totalDuration)), traceId
            );
        } catch (Exception e) {
            log.error("Failed to update agent_run: {}", e.getMessage());
        }

        agentMetrics.recordPipelineStage("audit_run_total", totalDuration);
        return new AgentRunResult(traceId, request.taskId(), configHash, overallStatus, false, businessNodes, traceNodes, totalDuration);
    }

    private AgentRunResult findCachedRun(String taskId, String configHash) {
        var rows = jdbc.queryForList(
            "SELECT trace_id, status FROM agent_runs WHERE task_id = ? AND config_hash = ? AND status IN ('success', 'warning') ORDER BY finished_at DESC LIMIT 1",
            taskId, configHash
        );
        if (rows.isEmpty()) return null;

        String traceId = (String) rows.get(0).get("trace_id");
        String status = (String) rows.get(0).get("status");
        List<BusinessNode> business = loadBusinessNodes(traceId);
        List<TraceNode> developer = loadTraceNodes(traceId);

        if (business.isEmpty()) return null;

        return new AgentRunResult(traceId, taskId, configHash, status, true, business, developer, 0);
    }

    private String computeConfigHash(AuditRequest request) {
        try {
            String canonical = objectMapper.writeValueAsString(Map.of(
                "taskName", request.taskName() != null ? request.taskName() : "",
                "instruction", request.instruction() != null ? request.instruction() : "",
                "sampleDataCount", request.sampleData() != null ? request.sampleData().size() : 0,
                "schemaCount", request.schemaComponents() != null ? request.schemaComponents().size() : 0,
                "rubricCount", request.rubricRules() != null ? request.rubricRules().size() : 0,
                "dimensionCount", request.rubricDimensions() != null ? request.rubricDimensions().size() : 0
            ));
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(canonical.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString().substring(0, 16);
        } catch (Exception e) {
            return "hash_" + System.currentTimeMillis();
        }
    }

    private TraceNode buildTraceNode(String traceId, String id, String type, String title, String status, long durationMs, String ragContext, List<SkillRegistryService.SkillMeta> skills, List<SkillRegistryService.SkillFinding> findings) {
        Map<String, Object> ragInfo = ragContext != null && !ragContext.isEmpty()
            ? Map.of("context", ragContext.length() > 300 ? ragContext.substring(0, 300) + "…" : ragContext, "hasContent", true)
            : Map.of("hasContent", false);
        Map<String, Object> skillInfo = skills.isEmpty()
            ? Map.of("used", false)
            : Map.of("used", true, "skills", skills.stream().map(SkillRegistryService.SkillMeta::name).toList(), "findingCount", findings.size());
        return new TraceNode(id, type, title, status, durationMs, null, null, null, ragInfo, skillInfo, null, null, List.of());
    }

    private void persistBusinessNodes(String traceId, List<BusinessNode> nodes) {
        for (BusinessNode n : nodes) {
            try {
                jdbc.update(
                    "INSERT INTO business_nodes (id, trace_id, node_key, title, status, summary, evidence, impact, suggestion, reference_sources, fix_step, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    n.id(), traceId, n.nodeKey(), n.title(), n.status(), n.summary(), n.evidence(), n.impact(), n.suggestion(),
                    String.join(",", n.referenceSources()), n.fixStep(), n.durationMs()
                );
            } catch (Exception e) {
                log.warn("Failed to persist business node: {}", e.getMessage());
            }
        }
    }

    private void persistTraceNodes(String traceId, List<TraceNode> nodes) {
        for (TraceNode n : nodes) {
            try {
                jdbc.update(
                    "INSERT INTO trace_nodes (id, trace_id, node_type, title, status, duration_ms) VALUES (?, ?, ?, ?, ?, ?)",
                    n.id(), traceId, n.type(), n.title(), n.status(), n.durationMs()
                );
            } catch (Exception e) {
                log.warn("Failed to persist trace node: {}", e.getMessage());
            }
        }
    }

    private List<BusinessNode> loadBusinessNodes(String traceId) {
        return jdbc.query(
            "SELECT * FROM business_nodes WHERE trace_id = ? ORDER BY id",
            (rs, i) -> new BusinessNode(
                rs.getString("id"), rs.getString("node_key"), rs.getString("title"),
                rs.getString("status"), rs.getString("summary"), rs.getString("evidence"),
                rs.getString("impact"), rs.getString("suggestion"),
                rs.getString("reference_sources") != null ? Arrays.asList(rs.getString("reference_sources").split(",")) : List.of(),
                rs.getString("fix_step"), rs.getLong("duration_ms")
            ),
            traceId
        );
    }

    private List<TraceNode> loadTraceNodes(String traceId) {
        return jdbc.query(
            "SELECT * FROM trace_nodes WHERE trace_id = ? ORDER BY id",
            (rs, i) -> new TraceNode(
                rs.getString("id"), rs.getString("node_type"), rs.getString("title"),
                rs.getString("status"), rs.getLong("duration_ms"), null, null, null, null, null, null, null, List.of()
            ),
            traceId
        );
    }
}
