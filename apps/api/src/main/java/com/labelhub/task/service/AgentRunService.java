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

    private static final List<String> EXPECTED_BUSINESS_NODES = List.of(
        "task_description", "sample_data", "annotation_template",
        "quality_rules", "comprehensive_assessment", "publish_readiness"
    );

    private static final Map<String, String> NODE_AGENT_MAP = Map.of(
        "task_description", "task_context_builder",
        "sample_data", "dataset_sampler",
        "annotation_template", "schema_generator",
        "quality_rules", "rubric_generator",
        "comprehensive_assessment", "critic",
        "publish_readiness", "task_package_writer"
    );

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
                               String suggestion, List<String> referenceSources, String fixStep, long durationMs,
                               Map<String, Object> details) {}

    public record TraceNode(String id, String type, String title, String status,
                            long durationMs, Object inputPreview, Object outputPreview,
                            Map<String, Object> prompt, Map<String, Object> rag,
                            Map<String, Object> skill, Map<String, Object> mcp,
                            Map<String, Object> sandbox, List<String> children) {}

    public record AgentRunResult(String traceId, String taskId, String configHash,
                                 String status, boolean fromCache,
                                 List<BusinessNode> businessDag,
                                 List<TraceNode> developerDag,
                                 long durationMs,
                                 boolean traceCompleteness,
                                 List<String> missingNodes) {}

    public AgentRunResult executeOrReuse(AuditRequest request) {
        String configHash = computeConfigHash(request);

        if (!request.forceRun()) {
            AgentRunResult cached = findCachedRun(request.taskId(), configHash);
            if (cached != null) {
                agentMetrics.recordAuditCacheHit();
                agentMetrics.recordAuditRun(cached.status(), true);
                agentMetrics.recordPipelineStage("audit_cache_hit", 0);
                log.info("Returning cached audit run for task={} hash={}", request.taskId(), configHash);
                return cached;
            }
        }

        agentMetrics.recordAuditCacheMiss();
        agentMetrics.recordPipelineStage("audit_cache_miss", 0);
        return executeFullRun(request, configHash);
    }

    public AgentRunResult getRunByTraceId(String traceId) {
        var rows = jdbc.queryForList("SELECT * FROM agent_runs WHERE trace_id = ?", traceId);
        if (rows.isEmpty()) return null;
        var row = rows.get(0);
        List<BusinessNode> business = loadBusinessNodes(traceId);
        List<TraceNode> developer = loadTraceNodes(traceId);
        TraceCompleteness completeness = evaluateCompleteness(traceId, business, developer, row);
        return new AgentRunResult(
            traceId, (String) row.get("task_id"), (String) row.get("config_hash"),
            (String) row.get("status"), Boolean.TRUE.equals(row.get("from_cache")),
            business, developer, 0,
            completeness.complete(), completeness.missingNodes()
        );
    }

    public AgentRunResult findByTaskAndHash(String taskId, String configHash) {
        return findCachedRun(taskId, configHash);
    }

    public List<Map<String, Object>> listRecentRuns(int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        return jdbc.queryForList(
            """
            SELECT r.trace_id, r.task_id, r.config_hash, r.status, r.from_cache, r.finished_at,
                   r.trace_completeness,
                   (SELECT COUNT(*) FROM business_nodes b WHERE b.trace_id = r.trace_id) AS business_node_count,
                   (SELECT COUNT(*) FROM trace_nodes t WHERE t.trace_id = r.trace_id) AS developer_node_count
            FROM agent_runs r
            WHERE r.finished_at IS NOT NULL
            ORDER BY r.finished_at DESC
            LIMIT ?
            """,
            safeLimit
        );
    }

    private void recordRagMetrics(String agent, String nodeKey, String ragContext, long durationMs,
                                  String taskId, String traceId) {
        String source = "knowledge_base";
        if (ragContext == null || ragContext.isBlank()) {
            agentMetrics.recordRagEmptyRecall(agent, nodeKey, source, taskId, traceId);
            agentMetrics.recordRagRetrieval(agent, nodeKey, source, "empty", taskId, traceId);
        } else {
            agentMetrics.recordRagRetrieval(agent, nodeKey, source, "hit", taskId, traceId);
            agentMetrics.recordRagContextChars(agent, nodeKey, source, ragContext.length(), taskId, traceId);
        }
        agentMetrics.recordRagRetrievalDuration(agent, nodeKey, source, durationMs, taskId, traceId);
    }

    private void recordSkillMetrics(String agent, String nodeKey, List<SkillRegistryService.SkillMeta> skills,
                                    List<SkillRegistryService.SkillFinding> findings,
                                    String taskId, String traceId) {
        for (var skill : skills) {
            agentMetrics.recordSkillSelected(agent, nodeKey, skill.name(), "selected", taskId, traceId);
        }
        for (var finding : findings) {
            String skillName = finding.skillName() != null ? finding.skillName() : "unknown";
            agentMetrics.recordSkillFinding(agent, nodeKey, skillName, finding.severity(), taskId, traceId);
        }
    }

    private void recordSandboxMetrics(String agent, String nodeKey, SandboxExecutionService.SandboxResult result,
                                      String taskId, String traceId) {
        agentMetrics.recordToolCall(agent, nodeKey, result.toolName(), result.status(), taskId, traceId);
        agentMetrics.recordToolCallDuration(agent, nodeKey, result.toolName(), result.durationMs(), taskId, traceId);
    }

    private Map<String, Object> enrichDetails(String agent, String nodeKey, String traceId,
                                              Map<String, Object> base, String ragStatus,
                                              int skillCount, int toolCallCount, int mcpCount) {
        Map<String, Object> enriched = new LinkedHashMap<>(base);
        enriched.put("agent", agent);
        enriched.put("nodeKey", nodeKey);
        enriched.put("traceId", traceId);
        enriched.put("ragStatus", ragStatus);
        enriched.put("skillCount", skillCount);
        enriched.put("toolCallCount", toolCallCount);
        enriched.put("mcpCount", mcpCount);
        return enriched;
    }

    private AgentRunResult executeFullRun(AuditRequest request, String configHash) {
        String traceId = "trace_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
        String taskId = request.taskId();
        long runStart = System.currentTimeMillis();

        jdbc.update(
            "INSERT INTO agent_runs (trace_id, task_id, config_hash, status, from_cache) VALUES (?, ?, ?, 'running', FALSE)",
            traceId, taskId, configHash
        );

        List<BusinessNode> businessNodes = new ArrayList<>();
        List<TraceNode> traceNodes = new ArrayList<>();

        // Node 1: Task Description Check
        String agent1 = NODE_AGENT_MAP.get("task_description");
        long nodeStart = System.currentTimeMillis();
        long ragStart1 = System.currentTimeMillis();
        String ragContext1 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "task_context");
        long ragDuration1 = System.currentTimeMillis() - ragStart1;
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
        String instrEvidence = !ragContext1.isEmpty() ? "参考知识：" + ragContext1.lines().limit(2).reduce("", (a, b) -> a + b) : "未召回业务知识，当前基于通用检查模型静态评估";
        String instrImpact = instrStatus.equals("warning") ? "说明不清晰可能导致标注员理解偏差和频繁的确认沟通，降低整体吞吐率" : "";
        String instrSuggestion = instrFindings.isEmpty() ? "建议后续根据 bad case 继续丰富边界说明" : instrFindings.get(0).suggestion();
        String ragStatus1 = ragContext1.isBlank() ? "empty" : "hit";

        Map<String, Object> instrDetails = enrichDetails(agent1, "task_description", traceId, Map.of(
            "checkedItems", "目标定义, 实体边界, 判罚逻辑, 格式要求",
            "criteria", "无高危严重度发现项",
            "actual", instrFindings.isEmpty() ? "0 项高危问题" : instrFindings.size() + " 项需优化",
            "evidenceItems", instrFindings.stream().map(SkillRegistryService.SkillFinding::description).toList(),
            "risk", instrImpact,
            "action", instrSuggestion
        ), ragStatus1, instructionSkills.size(), 0, 0);

        businessNodes.add(new BusinessNode(traceId + "_bn_1", "task_description", "任务说明", instrStatus, instrSummary, instrEvidence, instrImpact, instrSuggestion, ragContext1.isEmpty() ? List.of() : List.of("标注规范"), "upload", node1Duration, instrDetails));
        traceNodes.add(buildTraceNode(traceId + "_tn_1", "agent", "任务说明审核", instrStatus, node1Duration, ragContext1, instructionSkills, instrFindings, null, null));
        recordRagMetrics(agent1, "task_description", ragContext1, ragDuration1, taskId, traceId);
        recordSkillMetrics(agent1, "task_description", instructionSkills, instrFindings, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("task_description", "agent", node1Duration);

        // Node 2: Sample Data Check
        String agent2 = NODE_AGENT_MAP.get("sample_data");
        nodeStart = System.currentTimeMillis();
        long ragStart2 = System.currentTimeMillis();
        String ragContext2 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "dataset_sampler");
        long ragDuration2 = System.currentTimeMillis() - ragStart2;
        var dataResult = sandboxService.executeDatasetCheck(traceId, request.sampleData() != null ? request.sampleData() : List.of());
        long node2Duration = System.currentTimeMillis() - nodeStart;

        int sampleCount = request.sampleData() != null ? request.sampleData().size() : 0;
        String dataStatus = dataResult.exitCode() == 0 && sampleCount >= 3 ? "success" : "warning";
        String dataSummary = sampleCount == 0 ? "缺少样例数据" : String.format("共 %d 条样例数据，%s", sampleCount, dataResult.findings().isEmpty() ? "字段覆盖完整，数据有效" : dataResult.findings().get(0));
        String ragStatus2 = ragContext2.isBlank() ? "empty" : "hit";

        Map<String, Object> dataDetails = enrichDetails(agent2, "sample_data", traceId, Map.of(
            "checkedItems", "样本数量, 字段存在性, 结构一致性",
            "criteria", "样本数 >= 3, 沙盒校验返回成功",
            "actual", "实际上传 " + sampleCount + " 条",
            "evidenceItems", dataResult.findings(),
            "risk", dataStatus.equals("warning") ? "样例不足会导致后续无法为 AI/标注员提供有效的 Few-Shot 提示，影响启动准确率" : "",
            "action", dataResult.findings().isEmpty() ? "无需动作" : "请返回 [数据上传] 步骤补充更多样例，或修复字段为空的数据"
        ), ragStatus2, 0, 1, 0);

        businessNodes.add(new BusinessNode(traceId + "_bn_2", "sample_data", "样例数据", dataStatus, dataSummary, ragContext2.isEmpty() ? "通过配置校验器直接检查" : "参考数据规范", dataStatus.equals("warning") ? "数据不足可能影响 AI 生成质量" : "", dataResult.findings().isEmpty() ? "" : "补充更多样例或修复空字段", ragContext2.isEmpty() ? List.of() : List.of("数据规范"), "upload", node2Duration, dataDetails));
        traceNodes.add(buildTraceNode(traceId + "_tn_2", "sandbox", "数据集校验", dataStatus, node2Duration, ragContext2, List.of(), List.of(), dataResult, null));
        recordRagMetrics(agent2, "sample_data", ragContext2, ragDuration2, taskId, traceId);
        recordSandboxMetrics(agent2, "sample_data", dataResult, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("sample_data", "sandbox", node2Duration);

        // Node 3: Schema Template Check
        String agent3 = NODE_AGENT_MAP.get("annotation_template");
        nodeStart = System.currentTimeMillis();
        long ragStart3 = System.currentTimeMillis();
        String ragContext3 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "schema_generator");
        long ragDuration3 = System.currentTimeMillis() - ragStart3;
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
        String schemaSummary = compCount == 0 ? "缺少标注模板组件" : String.format("%d 个标注组件，%s", compCount, schemaResult.findings().isEmpty() ? "与样例映射正确" : schemaResult.findings().get(0));
        String ragStatus3 = ragContext3.isBlank() ? "empty" : "hit";

        Map<String, Object> schemaDetails = enrichDetails(agent3, "annotation_template", traceId, Map.of(
            "checkedItems", "组件有效性, 数据源映射关系, 必填项约束",
            "criteria", "组件数 > 0 且沙盒/Skill无高危报错",
            "actual", "有效组件 " + compCount + " 个",
            "evidenceItems", schemaFindings.stream().map(SkillRegistryService.SkillFinding::description).toList(),
            "risk", schemaStatus.equals("warning") ? "模板残缺或字段未映射会导致标注页无法正确渲染表单，前端无法收集结果" : "",
            "action", schemaFindings.isEmpty() ? "无需动作" : schemaFindings.get(0).suggestion()
        ), ragStatus3, schemaSkills.size(), 1, 0);

        businessNodes.add(new BusinessNode(traceId + "_bn_3", "annotation_template", "标注模板", schemaStatus, schemaSummary, ragContext3.isEmpty() ? "基于通用组件规范" : "参考模板规范", schemaStatus.equals("warning") ? "模板不完整会导致标注员无法正确提交" : "", schemaFindings.isEmpty() ? "" : schemaFindings.get(0).suggestion(), ragContext3.isEmpty() ? List.of() : List.of("模板规范"), "template", node3Duration, schemaDetails));
        traceNodes.add(buildTraceNode(traceId + "_tn_3", "tool", "Schema 校验", schemaStatus, node3Duration, ragContext3, schemaSkills, schemaFindings, schemaResult, null));
        recordRagMetrics(agent3, "annotation_template", ragContext3, ragDuration3, taskId, traceId);
        recordSkillMetrics(agent3, "annotation_template", schemaSkills, schemaFindings, taskId, traceId);
        recordSandboxMetrics(agent3, "annotation_template", schemaResult, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("annotation_template", "tool", node3Duration);

        // Node 4: Quality Rules Check
        String agent4 = NODE_AGENT_MAP.get("quality_rules");
        nodeStart = System.currentTimeMillis();
        long ragStart4 = System.currentTimeMillis();
        String ragContext4 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "rubric_generator");
        long ragDuration4 = System.currentTimeMillis() - ragStart4;
        var rubricResult = sandboxService.executeRubricCheck(traceId, request.rubricRules() != null ? request.rubricRules() : List.of(), request.rubricDimensions() != null ? request.rubricDimensions() : List.of());
        long node4Duration = System.currentTimeMillis() - nodeStart;

        int ruleCount = request.rubricRules() != null ? request.rubricRules().size() : 0;
        String rubricStatus = rubricResult.exitCode() == 0 && ruleCount > 0 ? "success" : "warning";
        String rubricSummary = ruleCount == 0 ? "缺少质检规则" : String.format("%d 条质检规则，%s", ruleCount, rubricResult.findings().isEmpty() ? "已覆盖目标维度" : rubricResult.findings().get(0));
        String ragStatus4 = ragContext4.isBlank() ? "empty" : "hit";

        Map<String, Object> rubricDetails = enrichDetails(agent4, "quality_rules", traceId, Map.of(
            "checkedItems", "规则有效性, 维度覆盖率",
            "criteria", "规则数 > 0",
            "actual", "实际配置了 " + ruleCount + " 条",
            "evidenceItems", rubricResult.findings(),
            "risk", rubricStatus.equals("warning") ? "缺乏量化的规则会导致机器和人工质检都失去标准，模型预标注的质量无法评估" : "",
            "action", rubricResult.findings().isEmpty() ? "无需动作" : "返回 [质检规则] 步骤补充维度和规则描述"
        ), ragStatus4, 0, 1, 0);

        businessNodes.add(new BusinessNode(traceId + "_bn_4", "quality_rules", "质检规则", rubricStatus, rubricSummary, ragContext4.isEmpty() ? "通用规则检查" : "参考质检规范", rubricStatus.equals("warning") ? "缺少规则可能导致审核无标准" : "", rubricResult.findings().isEmpty() ? "" : "补充质检规则和评分维度", ragContext4.isEmpty() ? List.of() : List.of("质检规则"), "rules", node4Duration, rubricDetails));
        traceNodes.add(buildTraceNode(traceId + "_tn_4", "tool", "Rubric 校验", rubricStatus, node4Duration, ragContext4, List.of(), List.of(), rubricResult, null));
        recordRagMetrics(agent4, "quality_rules", ragContext4, ragDuration4, taskId, traceId);
        recordSandboxMetrics(agent4, "quality_rules", rubricResult, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("quality_rules", "tool", node4Duration);

        // Node 5: Comprehensive Assessment
        String agent5 = NODE_AGENT_MAP.get("comprehensive_assessment");
        nodeStart = System.currentTimeMillis();
        long ragStart5 = System.currentTimeMillis();
        String ragContext5 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "critic");
        long ragDuration5 = System.currentTimeMillis() - ragStart5;
        boolean hasAll = compCount > 0 && ruleCount > 0 && sampleCount >= 3;
        long node5Duration = System.currentTimeMillis() - nodeStart;

        String assessStatus = hasAll ? "success" : "warning";
        String assessSummary = hasAll ? "上游各子项校验通过，整体可流转" : "关键检查未通过，请修复后再发";
        List<String> issues = new ArrayList<>();
        if (compCount == 0) issues.add("缺少标注模板");
        if (ruleCount == 0) issues.add("缺少质检规则");
        if (sampleCount < 3) issues.add("样例不足 3 条");
        String ragStatus5 = ragContext5.isBlank() ? "empty" : "hit";

        Map<String, Object> assessDetails = enrichDetails(agent5, "comprehensive_assessment", traceId, Map.of(
            "checkedItems", "前置依赖的通过状态 (依赖 1-4 节点聚合结果)",
            "criteria", "前置节点 status 必须均为 success",
            "actual", hasAll ? "全部条件满足" : issues.size() + " 个未满足条件",
            "evidenceItems", issues,
            "risk", hasAll ? "" : "强行发布将会进入残缺状态，B/C端不可见",
            "action", hasAll ? "可以进行最终封装" : "修复: " + String.join("、", issues)
        ), ragStatus5, 0, 0, 0);

        businessNodes.add(new BusinessNode(traceId + "_bn_5", "comprehensive_assessment", "综合评估", assessStatus, assessSummary, ragContext5.isEmpty() ? "静态聚合" : "参考评分标准", hasAll ? "" : "不完整的配置可能影响标注质量和效率", issues.isEmpty() ? "" : "修复: " + String.join("、", issues), ragContext5.isEmpty() ? List.of() : List.of("项目要求"), "publish", node5Duration, assessDetails));
        traceNodes.add(buildTraceNode(traceId + "_tn_5", "agent", "综合评估", assessStatus, node5Duration, ragContext5, List.of(), List.of(), null, null));
        recordRagMetrics(agent5, "comprehensive_assessment", ragContext5, ragDuration5, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("comprehensive_assessment", "agent", node5Duration);

        // Node 6: Publish Readiness
        String agent6 = NODE_AGENT_MAP.get("publish_readiness");
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
        String pkgSummary = pkgStatus.equals("success") ? "符合 B/C 模块数据交互契约" : "任务包结构验证失败";

        int mcpCount = 0;
        List<Map<String, Object>> mcpProbeResults = new ArrayList<>();
        for (var server : mcpGateway.listServers()) {
            mcpCount++;
            String mcpStatus = server.available() ? "available" : "unavailable";
            agentMetrics.recordMcpCall(agent6, "publish_readiness", server.name(), "probe", mcpStatus, taskId, traceId);
            mcpProbeResults.add(Map.of("server", server.name(), "status", mcpStatus));
        }

        Map<String, Object> pkgDetails = enrichDetails(agent6, "publish_readiness", traceId, Map.of(
            "checkedItems", "TaskPackage 结构、必填字段",
            "criteria", "无数据类型错误、未漏传必填字段",
            "actual", pkgStatus.equals("success") ? "契约校验通过" : "发现 Schema 异常",
            "evidenceItems", pkgResult.findings(),
            "risk", pkgStatus.equals("warning") ? "下游 B/C 端解析报错，导致任务不可见" : "",
            "action", pkgStatus.equals("warning") ? "通常是服务异常，请重试或反馈给技术" : "完成",
            "mcpProbes", mcpProbeResults
        ), "n/a", 0, 1, mcpCount);

        businessNodes.add(new BusinessNode(traceId + "_bn_6", "publish_readiness", "发布准备", pkgStatus, pkgSummary, "下游 API 契约协议", pkgStatus.equals("warning") ? "不完整的任务包无法被 B/C 模块正确消费" : "", pkgResult.findings().isEmpty() ? "" : pkgResult.findings().get(0), List.of(), "publish", node6Duration, pkgDetails));
        traceNodes.add(buildTraceNode(traceId + "_tn_6", "tool", "任务包校验", pkgStatus, node6Duration, "", List.of(), List.of(), pkgResult, Map.of("probes", mcpProbeResults)));
        recordSandboxMetrics(agent6, "publish_readiness", pkgResult, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("publish_readiness", "tool", node6Duration);

        // Finalize persistence
        long totalDuration = System.currentTimeMillis() - runStart;
        List<String> persistFailures = new ArrayList<>();
        persistFailures.addAll(persistBusinessNodes(traceId, taskId, businessNodes));
        persistFailures.addAll(persistTraceNodes(traceId, taskId, traceNodes));

        TraceCompleteness completeness = evaluateCompleteness(traceId, businessNodes, traceNodes, null);
        if (!persistFailures.isEmpty()) {
            completeness = new TraceCompleteness(false, persistFailures);
            for (String failedNode : persistFailures) {
                String agent = NODE_AGENT_MAP.getOrDefault(failedNode, "unknown");
                agentMetrics.recordTracePersistFailed(agent, failedNode, taskId, traceId);
            }
        }

        boolean allPassed = businessNodes.stream().allMatch(n -> "success".equals(n.status()));
        String overallStatus = persistFailures.isEmpty()
            ? (allPassed ? "success" : "warning")
            : "partial";

        try {
            jdbc.update(
                "UPDATE agent_runs SET status = ?, finished_at = NOW(), result_json = ?, trace_completeness = ?, missing_nodes_json = ? WHERE trace_id = ?",
                overallStatus,
                objectMapper.writeValueAsString(Map.of("allPassed", allPassed, "durationMs", totalDuration, "persistFailures", persistFailures)),
                completeness.complete(),
                objectMapper.writeValueAsString(completeness.missingNodes()),
                traceId
            );
        } catch (Exception e) {
            log.error("Failed to update agent_run: {}", e.getMessage());
        }

        agentMetrics.recordAuditRun(overallStatus, false);
        agentMetrics.recordPipelineStage("audit_run_total", totalDuration);
        return new AgentRunResult(traceId, taskId, configHash, overallStatus, false, businessNodes, traceNodes, totalDuration, completeness.complete(), completeness.missingNodes());
    }

    private AgentRunResult findCachedRun(String taskId, String configHash) {
        var rows = jdbc.queryForList(
            "SELECT trace_id, status FROM agent_runs WHERE task_id = ? AND config_hash = ? AND status IN ('success', 'warning', 'partial') ORDER BY finished_at DESC LIMIT 1",
            taskId, configHash
        );
        if (rows.isEmpty()) return null;

        String traceId = (String) rows.get(0).get("trace_id");
        String status = (String) rows.get(0).get("status");
        List<BusinessNode> business = loadBusinessNodes(traceId);
        List<TraceNode> developer = loadTraceNodes(traceId);

        if (business.isEmpty()) return null;

        TraceCompleteness completeness = evaluateCompleteness(traceId, business, developer, null);
        return new AgentRunResult(traceId, taskId, configHash, status, true, business, developer, 0, completeness.complete(), completeness.missingNodes());
    }

    private record TraceCompleteness(boolean complete, List<String> missingNodes) {}

    private TraceCompleteness evaluateCompleteness(String traceId, List<BusinessNode> business,
                                                   List<TraceNode> developer, Map<String, Object> runRow) {
        List<String> missing = new ArrayList<>();
        Set<String> presentKeys = new HashSet<>();
        for (BusinessNode node : business) {
            presentKeys.add(node.nodeKey());
        }
        for (String expected : EXPECTED_BUSINESS_NODES) {
            if (!presentKeys.contains(expected)) {
                missing.add(expected);
            }
        }
        if (developer.isEmpty()) {
            missing.add("developer_trace");
        }
        boolean complete = missing.isEmpty();
        if (runRow != null && runRow.get("trace_completeness") != null) {
            complete = Boolean.TRUE.equals(runRow.get("trace_completeness")) && missing.isEmpty();
        }
        return new TraceCompleteness(complete, missing);
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

    private TraceNode buildTraceNode(String id, String type, String title, String status, long durationMs,
                                     String ragContext, List<SkillRegistryService.SkillMeta> skills,
                                     List<SkillRegistryService.SkillFinding> findings,
                                     SandboxExecutionService.SandboxResult sandboxResult,
                                     Map<String, Object> mcpInfo) {
        Map<String, Object> ragInfo = ragContext != null && !ragContext.isEmpty()
            ? Map.of("context", ragContext.length() > 300 ? ragContext.substring(0, 300) + "…" : ragContext, "hasContent", true, "charCount", ragContext.length())
            : Map.of("hasContent", false, "charCount", 0);
        Map<String, Object> skillInfo = skills.isEmpty()
            ? Map.of("used", false, "skills", List.of(), "findingCount", findings.size())
            : Map.of("used", true, "skills", skills.stream().map(SkillRegistryService.SkillMeta::name).toList(), "findingCount", findings.size(), "findings", findings.stream().map(SkillRegistryService.SkillFinding::description).toList());
        Map<String, Object> sandboxInfo = sandboxResult == null ? null : Map.of(
            "tool", sandboxResult.toolName(),
            "status", sandboxResult.status(),
            "exitCode", sandboxResult.exitCode(),
            "findings", sandboxResult.findings(),
            "durationMs", sandboxResult.durationMs()
        );
        return new TraceNode(id, type, title, status, durationMs, null, null, null, ragInfo, skillInfo, mcpInfo, sandboxInfo, List.of());
    }

    private List<String> persistBusinessNodes(String traceId, String taskId, List<BusinessNode> nodes) {
        List<String> failures = new ArrayList<>();
        for (BusinessNode n : nodes) {
            try {
                jdbc.update(
                    "INSERT INTO business_nodes (id, trace_id, node_key, title, status, summary, evidence, impact, suggestion, reference_sources, fix_step, duration_ms, details_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    n.id(), traceId, n.nodeKey(), n.title(), n.status(), n.summary(), n.evidence(), n.impact(), n.suggestion(),
                    String.join(",", n.referenceSources()), n.fixStep(), n.durationMs(),
                    n.details() != null ? objectMapper.writeValueAsString(n.details()) : null
                );
            } catch (Exception e) {
                log.error("Failed to persist business node {}: {}", n.nodeKey(), e.getMessage(), e);
                failures.add(n.nodeKey());
            }
        }
        return failures;
    }

    private List<String> persistTraceNodes(String traceId, String taskId, List<TraceNode> nodes) {
        List<String> failures = new ArrayList<>();
        for (TraceNode n : nodes) {
            try {
                jdbc.update(
                    "INSERT INTO trace_nodes (id, trace_id, node_type, title, status, duration_ms, input_preview, output_preview, prompt_json, rag_json, skill_json, mcp_json, sandbox_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    n.id(), traceId, n.type(), n.title(), n.status(), n.durationMs(),
                    n.inputPreview() != null ? objectMapper.writeValueAsString(n.inputPreview()) : null,
                    n.outputPreview() != null ? objectMapper.writeValueAsString(n.outputPreview()) : null,
                    n.prompt() != null ? objectMapper.writeValueAsString(n.prompt()) : null,
                    n.rag() != null ? objectMapper.writeValueAsString(n.rag()) : null,
                    n.skill() != null ? objectMapper.writeValueAsString(n.skill()) : null,
                    n.mcp() != null ? objectMapper.writeValueAsString(n.mcp()) : null,
                    n.sandbox() != null ? objectMapper.writeValueAsString(n.sandbox()) : null
                );
            } catch (Exception e) {
                log.error("Failed to persist trace node {}: {}", n.id(), e.getMessage(), e);
                failures.add(n.id());
            }
        }
        return failures;
    }

    private Map<String, Object> parseJsonToMap(String json) {
        if (json == null || json.isEmpty()) return null;
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            return null;
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
                rs.getString("fix_step"), rs.getLong("duration_ms"),
                parseJsonToMap(rs.getString("details_json"))
            ),
            traceId
        );
    }

    private List<TraceNode> loadTraceNodes(String traceId) {
        return jdbc.query(
            "SELECT * FROM trace_nodes WHERE trace_id = ? ORDER BY id",
            (rs, i) -> new TraceNode(
                rs.getString("id"), rs.getString("node_type"), rs.getString("title"),
                rs.getString("status"), rs.getLong("duration_ms"),
                parseJsonToMap(rs.getString("input_preview")),
                parseJsonToMap(rs.getString("output_preview")),
                parseJsonToMap(rs.getString("prompt_json")),
                parseJsonToMap(rs.getString("rag_json")),
                parseJsonToMap(rs.getString("skill_json")),
                parseJsonToMap(rs.getString("mcp_json")),
                parseJsonToMap(rs.getString("sandbox_json")),
                List.of()
            ),
            traceId
        );
    }
}
