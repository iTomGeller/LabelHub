package com.labelhub.task.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.stream.Stream;

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

    private static final int DETAILS_VERSION = 4;

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

    public AgentRunResult findLatestCompleteRun(String taskId) {
        var rows = jdbc.queryForList(
            """
            SELECT trace_id, status, config_hash FROM agent_runs
            WHERE task_id = ? AND finished_at IS NOT NULL
              AND status IN ('success', 'warning', 'partial')
            ORDER BY finished_at DESC LIMIT 1
            """,
            taskId
        );
        if (rows.isEmpty()) return null;
        String traceId = (String) rows.get(0).get("trace_id");
        String status = (String) rows.get(0).get("status");
        String configHash = (String) rows.get(0).get("config_hash");
        List<BusinessNode> business = loadBusinessNodes(traceId);
        List<TraceNode> developer = loadTraceNodes(traceId);
        if (business.isEmpty()) return null;
        TraceCompleteness completeness = evaluateCompleteness(traceId, business, developer, null);
        return new AgentRunResult(traceId, taskId, configHash, status, true, business, developer, 0, completeness.complete(), completeness.missingNodes());
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

    private Map<String, Object> buildStructuredDetails(
            String agent, String nodeKey, String traceId, String nodeStatus,
            List<Map<String, Object>> checkedItems,
            List<Map<String, Object>> criteria,
            List<Map<String, Object>> actual,
            List<Map<String, Object>> evidenceItems,
            Map<String, Object> calls,
            Map<String, Object> userSummary,
            String riskLevel, String riskReason,
            String actionLabel, String actionStep, String actionReason,
            String ragStatus, int skillCount, int toolCallCount, int mcpCount) {
        Map<String, Object> enriched = new LinkedHashMap<>();
        enriched.put("schemaVersion", DETAILS_VERSION);
        enriched.put("detailsVersion", DETAILS_VERSION);
        enriched.put("agent", agent);
        enriched.put("nodeKey", nodeKey);
        enriched.put("traceId", traceId);
        enriched.put("checkedItems", checkedItems);
        enriched.put("criteria", criteria);
        enriched.put("actual", actual);
        enriched.put("evidenceItems", evidenceItems);
        enriched.put("calls", calls != null ? calls : Map.of());
        enriched.put("userSummary", userSummary != null ? userSummary : Map.of());
        enriched.put("risk", Map.of("level", riskLevel, "reason", riskReason != null ? riskReason : ""));
        enriched.put("action", Map.of("label", actionLabel, "step", actionStep, "reason", actionReason != null ? actionReason : ""));
        enriched.put("ragStatus", ragStatus);
        enriched.put("skillCount", skillCount);
        enriched.put("toolCallCount", toolCallCount);
        enriched.put("mcpCount", mcpCount);
        return enriched;
    }

    private Map<String, Object> buildUserSummary(String nodeStatus, String summary, String evidence,
                                                   String impact, String suggestion, String ragStatus) {
        String verdict = "success".equals(nodeStatus)
            ? ("empty".equals(ragStatus) ? "低置信" : "可发布")
            : "需修复";
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("verdict", verdict);
        m.put("conclusion", summary);
        m.put("evidenceSummary", evidence != null ? evidence : "");
        m.put("businessImpact", impact != null ? impact : "");
        m.put("nextStep", suggestion != null && !suggestion.isBlank()
            ? suggestion
            : ("success".equals(nodeStatus) ? "继续发布流程" : "返回对应步骤修复"));
        m.put("confidenceReason", "empty".equals(ragStatus) ? "知识库空召回，结论偏静态规则" : "");
        return m;
    }

    private Map<String, Object> buildPromptPreview(AuditRequest request, String agent, String businessNodeKey, String objective) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("agent", agent);
        p.put("businessNode", businessNodeKey);
        p.put("objective", objective);
        p.put("systemContext", "LabelHub AI 质量审核 · 输出可执行业务结论");
        Map<String, Object> userInput = new LinkedHashMap<>();
        userInput.put("taskName", request.taskName());
        userInput.put("instructionPreview", truncate(request.instruction(), 200));
        p.put("userInput", userInput);
        p.put("constraints", List.of("优先参考知识库", "失败时给出修复建议", "不暴露技术实现细节给使用者"));
        return p;
    }

    private List<Map<String, Object>> buildDecisionSteps(String businessNodeKey, List<Map<String, Object>> spans,
                                                          String status, String summary, String ragStatus) {
        List<Map<String, Object>> steps = new ArrayList<>();
        steps.add(Map.of(
            "id", businessNodeKey + "_dec_1",
            "title", "读取上游输入",
            "why", "汇总任务配置与上游检查结果，确定本节点审核目标",
            "inputRefs", List.of(businessNodeKey),
            "selectedCalls", List.of(),
            "result", "输入上下文就绪",
            "nextAction", spans.isEmpty() ? "使用静态规则评估" : "按策略触发外部调用"
        ));
        int round = 2;
        for (Map<String, Object> span : spans) {
            String spanId = String.valueOf(span.getOrDefault("id", "span_" + round));
            steps.add(Map.of(
                "id", businessNodeKey + "_dec_" + round,
                "title", "决策轮次 " + (round - 1) + " · " + span.getOrDefault("title", "调用"),
                "why", span.getOrDefault("whyCalled", "执行自动检查"),
                "inputRefs", List.of(spanId),
                "selectedCalls", List.of(spanId),
                "result", span.getOrDefault("resultSummary", ""),
                "nextAction", round < spans.size() + 1 ? "继续下一项检查" : "汇总 Agent 输出"
            ));
            round++;
        }
        steps.add(Map.of(
            "id", businessNodeKey + "_dec_final",
            "title", "汇总输出结论",
            "why", "综合各轮调用结果形成业务结论",
            "inputRefs", spans.stream().map(s -> String.valueOf(s.getOrDefault("id", ""))).toList(),
            "selectedCalls", List.of(),
            "result", summary,
            "nextAction", "success".equals(status) ? "传递到下游节点" : "提示用户修复"
        ));
        if ("empty".equals(ragStatus)) {
            steps.get(0);
            Map<String, Object> first = new LinkedHashMap<>(steps.get(0));
            first.put("result", first.get("result") + "（知识库空召回，将降级为静态规则）");
            steps.set(0, first);
        }
        return steps;
    }

    private Map<String, Object> buildInternalGraph(String businessNodeKey, Map<String, Object> promptPreview,
                                                   List<Map<String, Object>> spans, List<Map<String, Object>> decisionSteps,
                                                   String summary, String status) {
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        nodes.add(graphNode("prompt", "prompt", "Prompt 输入", promptPreview, null));
        nodes.add(graphNode("decision_main", "decision", "决策轮次", Map.of("stepCount", decisionSteps.size()), null));
        int y = 0;
        for (Map<String, Object> span : spans) {
            String id = String.valueOf(span.getOrDefault("id", "call_" + y));
            String kind = String.valueOf(span.getOrDefault("kind", "tool"));
            nodes.add(graphNode(id, kind, String.valueOf(span.getOrDefault("title", kind)), span.get("inputPreview"), span.get("outputPreview")));
            edges.add(graphEdge("decision_main", id));
            y++;
        }
        if (spans.isEmpty()) {
            nodes.add(graphNode("static_rule", "decision", "静态规则评估", Map.of("reason", "无外部调用，使用内置规则"), Map.of("status", status)));
            edges.add(graphEdge("decision_main", "static_rule"));
            edges.add(graphEdge("static_rule", "output"));
        } else {
            for (Map<String, Object> span : spans) {
                edges.add(graphEdge(String.valueOf(span.getOrDefault("id", "")), "output"));
            }
        }
        nodes.add(graphNode("output", "output", "Agent 输出", Map.of("conclusion", summary), Map.of("status", status)));
        edges.add(0, graphEdge("prompt", "decision_main"));
        Map<String, Object> graph = new LinkedHashMap<>();
        graph.put("nodes", nodes);
        graph.put("edges", edges);
        graph.put("businessNode", businessNodeKey);
        return graph;
    }

    private Map<String, Object> graphNode(String id, String type, String title, Object inputPreview, Object outputPreview) {
        Map<String, Object> n = new LinkedHashMap<>();
        n.put("id", id);
        n.put("type", type);
        n.put("title", title);
        if (inputPreview != null) n.put("inputPreview", inputPreview);
        if (outputPreview != null) n.put("outputPreview", outputPreview);
        return n;
    }

    private Map<String, Object> graphEdge(String from, String to) {
        return Map.of("from", from, "to", to);
    }

    private Map<String, Object> buildBusinessMapping(String businessNodeKey) {
        List<String> upstream = switch (businessNodeKey) {
            case "sample_data", "annotation_template", "quality_rules" -> List.of("task_description");
            case "comprehensive_assessment" -> List.of("task_description", "sample_data", "annotation_template", "quality_rules");
            case "publish_readiness" -> List.of("comprehensive_assessment");
            default -> List.of();
        };
        List<String> downstream = switch (businessNodeKey) {
            case "task_description" -> List.of("sample_data", "annotation_template", "quality_rules");
            case "sample_data", "annotation_template", "quality_rules" -> List.of("comprehensive_assessment");
            case "comprehensive_assessment" -> List.of("publish_readiness");
            default -> List.of();
        };
        return Map.of(
            "businessNode", businessNodeKey,
            "agent", NODE_AGENT_MAP.getOrDefault(businessNodeKey, businessNodeKey),
            "upstream", upstream,
            "downstream", downstream
        );
    }

    private List<Map<String, Object>> sampleFieldNames(List<Map<String, Object>> sampleData, int limit) {
        if (sampleData == null || sampleData.isEmpty()) return List.of();
        Set<String> keys = new LinkedHashSet<>();
        for (Map<String, Object> row : sampleData) {
            if (row != null) keys.addAll(row.keySet());
            if (keys.size() >= limit) break;
        }
        return keys.stream().limit(limit).map(k -> Map.<String, Object>of("label", k, "value", k, "status", "present")).toList();
    }

    private List<Map<String, Object>> schemaComponentEvidence(List<Map<String, Object>> components) {
        return EvidenceFormatUtil.schemaComponentEvidence(components);
    }

    private List<Map<String, Object>> rubricRuleEvidence(List<Map<String, Object>> rules) {
        if (rules == null || rules.isEmpty()) return List.of();
        Map<String, Integer> severityDist = new LinkedHashMap<>();
        int autoPass = 0;
        for (Map<String, Object> r : rules) {
            String sev = String.valueOf(r.getOrDefault("severity", "unknown"));
            severityDist.merge(sev, 1, Integer::sum);
            if (Boolean.TRUE.equals(r.get("allowAgentAutoPass"))) autoPass++;
        }
        List<Map<String, Object>> items = new ArrayList<>();
        items.add(Map.of("type", "distribution", "label", "规则总数", "value", rules.size(), "source", "rubricRules"));
        for (var e : severityDist.entrySet()) {
            items.add(Map.of("type", "severity", "label", EvidenceFormatUtil.severityZh(e.getKey()), "value", e.getValue(), "source", "rubricRules"));
        }
        items.add(Map.of("type", "auto_pass", "label", "允许自动通过", "value", autoPass, "source", "rubricRules"));
        return items;
    }

    private Map<String, Object> buildCallSpan(
            String id, String kind, String title, String whyCalled,
            Object inputPreview, Object outputPreview, String resultSummary,
            long durationMs, String status, String degradeReason) {
        Map<String, Object> span = new LinkedHashMap<>();
        span.put("id", id);
        span.put("kind", kind);
        span.put("title", title);
        span.put("whyCalled", whyCalled != null ? whyCalled : "");
        span.put("inputPreview", inputPreview != null ? inputPreview : Map.of());
        span.put("outputPreview", outputPreview != null ? outputPreview : Map.of());
        span.put("resultSummary", resultSummary != null ? resultSummary : "");
        span.put("durationMs", durationMs);
        span.put("status", status);
        span.put("degradeReason", degradeReason != null ? degradeReason : "");
        return span;
    }

    private Map<String, Object> buildRagSpan(String spanId, Map<String, Object> ragInfo, String auditNode, String whyCalled) {
        String query = String.valueOf(ragInfo.getOrDefault("query", ""));
        Map<String, Object> inputPreview = Map.of(
            "query", query,
            "auditNode", auditNode,
            "category", ragInfo.getOrDefault("category", "")
        );
        Map<String, Object> outputPreview = new LinkedHashMap<>();
        boolean hit = Boolean.TRUE.equals(ragInfo.get("hasContent"));
        String status = hit ? "success" : "warning";
        String degradeReason = "";
        String resultSummary;
        if (hit) {
            outputPreview.put("hitCount", ragInfo.getOrDefault("hitCount", 0));
            outputPreview.put("charCount", ragInfo.getOrDefault("charCount", 0));
            outputPreview.put("topChunks", ragInfo.getOrDefault("retrievedChunks", List.of()));
            if (Boolean.TRUE.equals(ragInfo.get("usedFallback"))) {
                outputPreview.put("usedFallback", true);
                degradeReason = "目标分类无命中，已跨分类 fallback";
            }
            resultSummary = String.format("召回 %s 个 chunk，共 %s 字", ragInfo.getOrDefault("hitCount", 0), ragInfo.getOrDefault("charCount", 0));
        } else {
            outputPreview.put("emptyReason", ragInfo.getOrDefault("emptyReason", "知识库未命中"));
            degradeReason = String.valueOf(ragInfo.getOrDefault("emptyReason", "知识库未命中，使用静态规则兜底"));
            resultSummary = degradeReason;
            status = "warning";
        }
        long durationMs = ragInfo.get("durationMs") instanceof Number n ? n.longValue() : 0L;
        return buildCallSpan(spanId, "rag", "知识库检索", whyCalled, inputPreview, outputPreview, resultSummary, durationMs, status, degradeReason);
    }

    private Map<String, Object> buildSkillSpan(String spanId, SkillRegistryService.SkillExecutionResult result, String triggeredBy) {
        Map<String, Object> outputPreview = result.outputPreview() != null ? result.outputPreview() : Map.of();
        String status = "warning".equals(result.status()) ? "warning" : "success";
        String resultSummary = result.findings().isEmpty()
            ? "检查完成，未发现额外问题"
            : result.findings().stream().map(SkillRegistryService.SkillFinding::description).limit(2).reduce((a, b) -> a + "；" + b).orElse("发现 " + result.findings().size() + " 条问题");
        return buildCallSpan(spanId, "skill", "技能执行 · " + result.skillName(), result.whyCalled(),
            result.inputPreview(), outputPreview, resultSummary, result.durationMs(), status, "");
    }

    private Map<String, Object> buildSandboxSpan(String spanId, SandboxExecutionService.SandboxResult result, String callKind, String whyCalled) {
        Map<String, Object> outputPreview = result.outputPreview() != null ? result.outputPreview() : Map.of();
        String status = result.exitCode() == 0 ? "success" : "warning";
        String resultSummary = result.findings().isEmpty()
            ? "自动检查通过"
            : result.findings().stream().limit(2).reduce((a, b) -> a + "；" + b).orElse("发现 " + result.findings().size() + " 条问题");
        String degradeReason = result.exitCode() != 0 ? "沙盒校验 exitCode=" + result.exitCode() : "";
        return buildCallSpan(spanId, callKind, toolTitle(result.toolName()), whyCalled,
            result.inputPreview(), outputPreview, resultSummary, result.durationMs(), status, degradeReason);
    }

    private Map<String, Object> buildMcpSpan(String spanId, Map<String, Object> mcpCall, String whyCalled) {
        Map<String, Object> inputPreview = mcpCall.get("inputPreview") instanceof Map<?, ?> m
            ? new LinkedHashMap<>((Map<String, Object>) m)
            : Map.of("server", mcpCall.getOrDefault("server", ""), "tool", mcpCall.getOrDefault("tool", "health_probe"));
        Map<String, Object> outputPreview = mcpCall.get("outputPreview") instanceof Map<?, ?> m
            ? new LinkedHashMap<>((Map<String, Object>) m)
            : Map.of("status", mcpCall.getOrDefault("status", ""), "error", mcpCall.getOrDefault("error", ""));
        String status = "available".equals(mcpCall.get("status")) ? "success" : "unavailable".equals(mcpCall.get("status")) ? "unavailable" : "warning";
        String error = String.valueOf(mcpCall.getOrDefault("error", ""));
        String degradeReason = !error.isBlank() ? error : "";
        String resultSummary = "available".equals(mcpCall.get("status")) ? "MCP 探测通过" : ("MCP 不可用：" + (error.isBlank() ? "未连接" : error));
        long durationMs = mcpCall.get("durationMs") instanceof Number n ? n.longValue() : 0L;
        return buildCallSpan(spanId, "mcp", "MCP 探测 · " + mcpCall.getOrDefault("server", ""), whyCalled,
            inputPreview, outputPreview, resultSummary, durationMs, status, degradeReason);
    }

    private String toolTitle(String toolName) {
        return switch (toolName) {
            case "schema_contract_checker" -> "模板契约检查";
            case "rubric_contract_checker" -> "质检规则检查";
            case "dataset_profile_checker" -> "样例数据校验";
            case "package_export_checker" -> "任务包导出检查";
            case "prompt_budget_checker" -> "Prompt 预算检查";
            default -> toolName;
        };
    }

    private String ragWhyCalled(String businessNodeKey) {
        return switch (businessNodeKey) {
            case "task_description" -> "为任务说明节点检索标注规范与任务要求";
            case "sample_data" -> "为样例数据节点检索数据规范与字段要求";
            case "annotation_template" -> "为标注模板节点检索组件与映射规范";
            case "quality_rules" -> "为质检规则节点检索评分与质检规范";
            case "comprehensive_assessment" -> "为综合评估节点检索评分标准与项目要求";
            case "publish_readiness" -> "为发布准备节点检索下游契约要求";
            default -> "检索相关业务知识以支撑审核结论";
        };
    }

    private String sandboxWhyCalled(String toolName) {
        return switch (toolName) {
            case "dataset_profile_checker" -> "校验样例数据字段覆盖、空值与重复";
            case "schema_contract_checker" -> "校验标注组件类型、dataPath 与必填项";
            case "rubric_contract_checker" -> "校验质检规则 severity 与评分维度";
            case "package_export_checker" -> "校验 TaskPackage 导出契约完整性";
            default -> "执行沙盒自动检查";
        };
    }

    private Map<String, Object> buildAgentInputPreview(AuditRequest request, String businessNodeKey) {
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("nodeKey", businessNodeKey);
        preview.put("taskId", request.taskId());
        preview.put("taskName", request.taskName());
        switch (businessNodeKey) {
            case "task_description" -> {
                preview.put("instructionLength", request.instruction() != null ? request.instruction().length() : 0);
                preview.put("instructionPreview", truncate(request.instruction(), 160));
            }
            case "sample_data" -> {
                preview.put("sampleCount", request.sampleData() != null ? request.sampleData().size() : 0);
                preview.put("fields", sampleFieldNames(request.sampleData(), 6).stream().map(m -> m.get("label")).toList());
            }
            case "annotation_template" -> preview.put("componentCount", request.schemaComponents() != null ? request.schemaComponents().size() : 0);
            case "quality_rules" -> {
                preview.put("ruleCount", request.rubricRules() != null ? request.rubricRules().size() : 0);
                preview.put("dimensions", request.rubricDimensions() != null ? request.rubricDimensions() : List.of());
            }
            case "comprehensive_assessment" -> preview.put("upstreamNodes", List.of("task_description", "sample_data", "annotation_template", "quality_rules"));
            case "publish_readiness" -> {
                preview.put("schemaComponentCount", request.schemaComponents() != null ? request.schemaComponents().size() : 0);
                preview.put("rubricRuleCount", request.rubricRules() != null ? request.rubricRules().size() : 0);
            }
        }
        return preview;
    }

    private Map<String, Object> buildAgentOutputPreview(String businessNodeKey, String status, String summary, List<Map<String, Object>> spans) {
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("nodeKey", businessNodeKey);
        preview.put("status", status);
        preview.put("conclusion", summary);
        preview.put("spanCount", spans.size());
        preview.put("spanSummaries", spans.stream().map(s -> Map.of(
            "kind", s.getOrDefault("kind", ""),
            "title", s.getOrDefault("title", ""),
            "resultSummary", s.getOrDefault("resultSummary", "")
        )).toList());
        return preview;
    }

    private String truncate(String text, int max) {
        if (text == null || text.isBlank()) return "";
        return text.length() > max ? text.substring(0, max) + "…" : text;
    }

    private List<Map<String, Object>> buildAllSpans(
            String traceId, String businessNodeKey, String auditNode,
            Map<String, Object> ragInfo,
            List<SkillRegistryService.SkillMeta> skills,
            List<SkillRegistryService.SkillExecutionResult> skillResults,
            List<SandboxExecutionService.SandboxResult> sandboxResults,
            List<Map<String, Object>> mcpCalls) {
        List<Map<String, Object>> spans = new ArrayList<>();
        int idx = 0;
        if (ragInfo != null && !ragInfo.isEmpty()) {
            spans.add(buildRagSpan(traceId + "_span_rag_" + businessNodeKey, ragInfo, auditNode, ragWhyCalled(businessNodeKey)));
            idx++;
        }
        for (SkillRegistryService.SkillExecutionResult sr : skillResults) {
            spans.add(buildSkillSpan(traceId + "_span_skill_" + idx++, sr, businessNodeKey));
        }
        if (sandboxResults != null) {
            for (SandboxExecutionService.SandboxResult r : sandboxResults) {
                String kind = r.toolName().contains("dataset") || r.toolName().contains("profile") ? "sandbox" : "tool";
                spans.add(buildSandboxSpan(traceId + "_span_" + kind + "_" + idx++, r, kind, sandboxWhyCalled(r.toolName())));
            }
        }
        if (mcpCalls != null) {
            for (Map<String, Object> mcp : mcpCalls) {
                spans.add(buildMcpSpan(traceId + "_span_mcp_" + idx++, mcp, "发布前探测外部 MCP 服务是否可用"));
            }
        }
        return spans;
    }

    private Map<String, Object> buildCallsEnvelope(
            Map<String, Object> ragInfo, Map<String, Object> skillInfo,
            List<Map<String, Object>> tools, List<Map<String, Object>> sandbox,
            List<Map<String, Object>> mcp, List<Map<String, Object>> spans) {
        Map<String, Object> calls = new LinkedHashMap<>();
        calls.put("rag", ragInfo);
        calls.put("skills", skillInfo);
        calls.put("tools", tools != null ? tools : List.of());
        calls.put("sandbox", sandbox != null ? sandbox : List.of());
        calls.put("mcp", mcp != null ? mcp : List.of());
        calls.put("spans", spans != null ? spans : List.of());
        return calls;
    }

    private Map<String, Object> buildRagInfo(String taskName, String instruction, String auditNode, long durationMs) {
        if (taskName != null && !taskName.isBlank() && auditNode != null && !auditNode.isBlank()) {
            return knowledgeBaseService.buildRagInfoMap(taskName, instruction != null ? instruction : "", auditNode, durationMs);
        }
        return Map.of("source", "knowledge_base", "hasContent", false, "charCount", 0, "durationMs", durationMs, "emptyReason", "未执行检索");
    }

    private Map<String, Object> buildSkillInfo(List<SkillRegistryService.SkillMeta> skills,
                                               List<SkillRegistryService.SkillFinding> findings,
                                               List<SkillRegistryService.SkillExecutionResult> skillResults) {
        if (skills.isEmpty()) {
            return Map.of("used", false, "skills", List.of(), "findingCount", findings.size(), "findings", List.of());
        }
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("used", true);
        info.put("skills", skills.stream().map(SkillRegistryService.SkillMeta::name).toList());
        info.put("findingCount", findings.size());
        info.put("findings", findings.stream().map(SkillRegistryService.SkillFinding::description).toList());
        info.put("severities", findings.stream().map(SkillRegistryService.SkillFinding::severity).toList());
        if (skillResults != null && !skillResults.isEmpty()) {
            info.put("executions", skillResults.stream().map(sr -> Map.of(
                "skillName", sr.skillName(),
                "inputPreview", sr.inputPreview() != null ? sr.inputPreview() : Map.of(),
                "outputPreview", sr.outputPreview() != null ? sr.outputPreview() : Map.of(),
                "whyCalled", sr.whyCalled() != null ? sr.whyCalled() : ""
            )).toList());
        }
        return info;
    }

    private Map<String, Object> buildSkillInfo(List<SkillRegistryService.SkillMeta> skills,
                                               List<SkillRegistryService.SkillFinding> findings) {
        return buildSkillInfo(skills, findings, List.of());
    }

    private Map<String, Object> sandboxToCall(SandboxExecutionService.SandboxResult result, String callKind) {
        Map<String, Object> call = new LinkedHashMap<>();
        call.put("callKind", callKind);
        call.put("tool", result.toolName());
        call.put("status", result.status());
        call.put("exitCode", result.exitCode());
        call.put("findings", result.findings());
        call.put("durationMs", result.durationMs());
        call.put("inputPreview", result.inputPreview() != null ? result.inputPreview() : Map.of());
        call.put("outputPreview", result.outputPreview() != null ? result.outputPreview() : Map.of());
        call.put("stdoutPreview", result.stdout() != null && result.stdout().length() > 200 ? result.stdout().substring(0, 200) + "…" : result.stdout());
        return call;
    }

    private static final Map<String, String> BUSINESS_TO_AUDIT_NODE = Map.of(
        "task_description", "task_context",
        "sample_data", "dataset_sampler",
        "annotation_template", "schema_generator",
        "quality_rules", "rubric_generator",
        "comprehensive_assessment", "critic",
        "publish_readiness", "task_package_writer"
    );

    private Map<String, Object> buildRagInfoForNode(AuditRequest request, String businessNodeKey, long durationMs) {
        String auditNode = BUSINESS_TO_AUDIT_NODE.getOrDefault(businessNodeKey, businessNodeKey);
        return buildRagInfo(request.taskName(), request.instruction(), auditNode, durationMs);
    }

    private TraceNode buildAgentExecutionNode(
            String id, String agent, String nodeKey, int sequence, String title, String status, long durationMs,
            AuditRequest request,
            Map<String, Object> ragInfo,
            List<SkillRegistryService.SkillMeta> skills,
            List<SkillRegistryService.SkillExecutionResult> skillResults,
            List<SkillRegistryService.SkillFinding> findings,
            List<SandboxExecutionService.SandboxResult> sandboxResults,
            List<Map<String, Object>> mcpCalls,
            String summary) {
        String auditNode = BUSINESS_TO_AUDIT_NODE.getOrDefault(nodeKey, nodeKey);
        List<Map<String, Object>> spans = buildAllSpans(id.replace("_tn_", "_"), nodeKey, auditNode, ragInfo, skills, skillResults, sandboxResults, mcpCalls);
        Map<String, Object> skillInfo = buildSkillInfo(skills, findings, skillResults);
        List<Map<String, Object>> tools = new ArrayList<>();
        List<Map<String, Object>> sandboxCalls = new ArrayList<>();
        if (sandboxResults != null) {
            for (SandboxExecutionService.SandboxResult r : sandboxResults) {
                Map<String, Object> call = sandboxToCall(r, r.toolName().contains("sandbox") || r.toolName().contains("dataset") || r.toolName().contains("profile") ? "sandbox" : "tool");
                if ("sandbox".equals(call.get("callKind"))) sandboxCalls.add(call);
                else tools.add(call);
            }
        }
        Map<String, Object> calls = buildCallsEnvelope(ragInfo, skillInfo, tools, sandboxCalls, mcpCalls, spans);
        Map<String, Object> inputPreview = buildAgentInputPreview(request, nodeKey);
        String ragStatus = ragInfo != null && Boolean.TRUE.equals(ragInfo.get("hasContent")) ? "hit" : "empty";
        Map<String, Object> promptPreview = buildPromptPreview(request, agent, nodeKey, summary);
        List<Map<String, Object>> decisionSteps = buildDecisionSteps(nodeKey, spans, status, summary, ragStatus);
        Map<String, Object> internalGraph = buildInternalGraph(nodeKey, promptPreview, spans, decisionSteps, summary, status);
        Map<String, Object> businessMapping = buildBusinessMapping(nodeKey);

        Map<String, Object> outputPreview = buildAgentOutputPreview(nodeKey, status, summary, spans);
        outputPreview.put("agent", agent);
        outputPreview.put("nodeKey", nodeKey);
        outputPreview.put("sequence", sequence);
        outputPreview.put("phase", "execute");
        outputPreview.put("callKind", "agent_execution");
        outputPreview.put("calls", calls);
        outputPreview.put("promptPreview", promptPreview);
        outputPreview.put("decisionSteps", decisionSteps);
        outputPreview.put("internalGraph", internalGraph);
        outputPreview.put("businessMapping", businessMapping);

        Map<String, Object> mcpInfo = mcpCalls != null && !mcpCalls.isEmpty() ? Map.of("probes", mcpCalls) : null;
        Map<String, Object> primarySandbox = sandboxCalls.isEmpty() ? (tools.isEmpty() ? null : tools.get(0)) : sandboxCalls.get(0);

        return new TraceNode(id, "agent_execution", title, status, durationMs, inputPreview, outputPreview,
            null, ragInfo, skillInfo, mcpInfo, primarySandbox, List.of());
    }

    private int countToolCalls(Map<String, Object> calls) {
        int count = 0;
        if (calls.get("tools") instanceof List<?> tools) count += tools.size();
        if (calls.get("sandbox") instanceof List<?> sandbox) count += sandbox.size();
        return count;
    }

    private void recordExecutionMetrics(String agent, String nodeKey, String status, String taskId, String traceId) {
        agentMetrics.recordTraceNode(agent, nodeKey, status, taskId);
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
        boolean sentimentTask = TaskSemanticAnalyzer.isSentimentClassificationTask(request);
        int ragEmptyCount = 0;

        // Node 1: Task Description Check
        String agent1 = NODE_AGENT_MAP.get("task_description");
        long nodeStart = System.currentTimeMillis();
        long ragStart1 = System.currentTimeMillis();
        String ragContext1 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "task_context");
        long ragDuration1 = System.currentTimeMillis() - ragStart1;
        var instructionSkills = skillRegistryService.getSkillsForNode("task_context");
        Map<String, Object> skillCtx = Map.of("taskName", request.taskName(), "instruction", request.instruction(), "sampleData", request.sampleData() != null ? request.sampleData() : List.of());
        List<SkillRegistryService.SkillFinding> instrFindings = new ArrayList<>();
        List<SkillRegistryService.SkillExecutionResult> instrSkillResults = new ArrayList<>();
        for (var skill : instructionSkills) {
            var result = skillRegistryService.executeSkill(skill, skillCtx);
            instrSkillResults.add(result);
            instrFindings.addAll(result.findings());
        }
        long node1Duration = System.currentTimeMillis() - nodeStart;

        if (ragContext1.isBlank()) ragEmptyCount++;

        String instrStatus = instrFindings.stream().anyMatch(f -> "high".equals(f.severity())) ? "warning" : "success";
        String instrSummary = instrFindings.isEmpty()
            ? (sentimentTask
                ? "客服情感分类任务说明完整，定义了正面/负面/中性/混合及触发关键句、判断理由"
                : "任务说明清晰完整，包含明确的标注目标和判断标准")
            : instrFindings.get(0).description();
        String instrEvidence = !ragContext1.isEmpty()
            ? "参考标注规范知识：" + ragContext1.lines().filter(l -> l.startsWith("-")).findFirst().orElse("已命中业务知识")
            : (sentimentTask ? "未召回标注规范，当前基于任务字段静态检查情感类别与理由要求" : "未召回业务知识，当前基于通用检查模型静态评估");
        String instrImpact = instrStatus.equals("warning") ? "说明不清晰可能导致标注员理解偏差和频繁的确认沟通，降低整体吞吐率" : "";
        String instrSuggestion = instrFindings.isEmpty() ? "建议后续根据 bad case 继续丰富边界说明" : instrFindings.get(0).suggestion();
        String ragStatus1 = ragContext1.isBlank() ? "empty" : "hit";
        Map<String, Object> ragInfo1 = buildRagInfoForNode(request, "task_description", ragDuration1);
        Map<String, Object> skillInfo1 = buildSkillInfo(instructionSkills, instrFindings, instrSkillResults);
        List<Map<String, Object>> spans1 = buildAllSpans(traceId, "task_description", "task_context", ragInfo1, instructionSkills, instrSkillResults, List.of(), List.of());
        Map<String, Object> calls1 = buildCallsEnvelope(ragInfo1, skillInfo1, List.of(), List.of(), List.of(), spans1);
        List<Map<String, Object>> instrEvidenceItems = new ArrayList<>(instrFindings.stream()
            .map(f -> Map.<String, Object>of("type", "skill_finding", "label", f.skillName(), "value", f.description(), "source", "skill"))
            .toList());
        if (sentimentTask) instrEvidenceItems.addAll(TaskSemanticAnalyzer.instructionEvidence(request));

        Map<String, Object> instrDetails = buildStructuredDetails(
            agent1, "task_description", traceId, instrStatus,
            List.of(
                Map.of("label", "任务名称", "value", request.taskName() != null ? request.taskName() : "", "status", request.taskName() != null && !request.taskName().isBlank() ? "ok" : "missing"),
                Map.of("label", "任务说明字数", "value", request.instruction() != null ? request.instruction().length() : 0, "status", "ok"),
                Map.of("label", "Skill 检查项", "value", instructionSkills.size(), "status", instructionSkills.isEmpty() ? "warn" : "ok")
            ),
            List.of(
                Map.of("label", "无高危 Skill finding", "expected", "0 high severity", "operator", "eq"),
                Map.of("label", "说明非空", "expected", "> 0 chars", "operator", "gt")
            ),
            List.of(
                Map.of("label", "高危 findings", "value",             instrFindings.stream().filter(f -> "high".equals(f.severity())).count(), "status", instrFindings.stream().anyMatch(f -> "high".equals(f.severity())) ? "fail" : "ok"),
                Map.of("label", "RAG 召回", "value", ragStatus1, "status", "empty".equals(ragStatus1) ? "warn" : "ok")
            ),
            instrEvidenceItems,
            calls1,
            buildUserSummary(instrStatus, instrSummary, instrEvidence, instrImpact, instrSuggestion, ragStatus1),
            instrStatus.equals("warning") ? "high" : "low",
            instrImpact,
            instrFindings.isEmpty() ? "继续观察" : "优化说明",
            instrFindings.isEmpty() ? "upload" : "upload",
            instrSuggestion,
            ragStatus1, instructionSkills.size(), countToolCalls(calls1), 0
        );

        businessNodes.add(new BusinessNode(traceId + "_bn_1", "task_description", "任务说明", instrStatus, instrSummary, instrEvidence, instrImpact, instrSuggestion, ragContext1.isEmpty() ? List.of() : List.of("标注规范"), "upload", node1Duration, instrDetails));
        traceNodes.add(buildAgentExecutionNode(traceId + "_tn_1", agent1, "task_description", 1, "任务说明审核", instrStatus, node1Duration, request, ragInfo1, instructionSkills, instrSkillResults, instrFindings, List.of(), List.of(), instrSummary));
        recordRagMetrics(agent1, "task_description", ragContext1, ragDuration1, taskId, traceId);
        if (ragContext1.isBlank()) agentMetrics.recordRagRunEmpty(agent1, "task_description", taskId);
        recordSkillMetrics(agent1, "task_description", instructionSkills, instrFindings, taskId, traceId);
        recordExecutionMetrics(agent1, "task_description", instrStatus, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("task_description", "agent_execution", node1Duration);

        // Node 2: Sample Data Check
        String agent2 = NODE_AGENT_MAP.get("sample_data");
        nodeStart = System.currentTimeMillis();
        long ragStart2 = System.currentTimeMillis();
        String ragContext2 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "dataset_sampler");
        long ragDuration2 = System.currentTimeMillis() - ragStart2;
        var dataResult = sandboxService.executeDatasetCheck(traceId, request.sampleData() != null ? request.sampleData() : List.of());
        long node2Duration = System.currentTimeMillis() - nodeStart;

        int sampleCount = request.sampleData() != null ? request.sampleData().size() : 0;
        if (ragContext2.isBlank()) ragEmptyCount++;
        String dataStatus = dataResult.exitCode() == 0 && sampleCount >= 3 ? "success" : "warning";
        String dataSummary = sampleCount == 0 ? "缺少样例数据"
            : (sentimentTask ? TaskSemanticAnalyzer.sampleCoverageSummary(request.sampleData())
                : String.format("共 %d 条样例数据，%s", sampleCount, dataResult.findings().isEmpty() ? "字段覆盖完整，数据有效" : dataResult.findings().get(0)));
        String ragStatus2 = ragContext2.isBlank() ? "empty" : "hit";
        Map<String, Object> ragInfo2 = buildRagInfoForNode(request, "sample_data", ragDuration2);
        Map<String, Object> skillInfo2 = buildSkillInfo(List.of(), List.of());
        List<Map<String, Object>> spans2 = buildAllSpans(traceId, "sample_data", "dataset_sampler", ragInfo2, List.of(), List.of(), List.of(dataResult), List.of());
        Map<String, Object> calls2 = buildCallsEnvelope(ragInfo2, skillInfo2, List.of(), List.of(sandboxToCall(dataResult, "sandbox")), List.of(), spans2);
        List<Map<String, Object>> fieldEvidence = sampleFieldNames(request.sampleData(), 8);
        List<Map<String, Object>> dataEvidenceItems = new ArrayList<>(Stream.concat(
            fieldEvidence.stream().map(f -> Map.<String, Object>of("type", "field", "label", f.get("label"), "value", f.get("value"), "source", "sampleData")),
            dataResult.findings().stream().map(f -> Map.<String, Object>of("type", "sandbox_finding", "label", "finding", "value", f, "source", "dataset_check"))
        ).toList());
        if (sentimentTask) dataEvidenceItems.addAll(TaskSemanticAnalyzer.sampleCoverageEvidence(request.sampleData()));

        Map<String, Object> dataDetails = buildStructuredDetails(
            agent2, "sample_data", traceId, dataStatus,
            List.of(
                Map.of("label", "样例条数", "value", sampleCount, "status", sampleCount >= 3 ? "ok" : "warn"),
                Map.of("label", "字段覆盖", "value", fieldEvidence.size() + " 个字段", "status", fieldEvidence.isEmpty() ? "warn" : "ok")
            ),
            List.of(
                Map.of("label", "最少样例数", "expected", ">= 3", "operator", "gte"),
                Map.of("label", "沙盒校验", "expected", "exitCode=0", "operator", "eq")
            ),
            List.of(
                Map.of("label", "实际上传", "value", sampleCount, "status", sampleCount >= 3 ? "ok" : "fail"),
                Map.of("label", "沙盒 exitCode", "value", dataResult.exitCode(), "status", dataResult.exitCode() == 0 ? "ok" : "fail"),
                Map.of("label", "RAG 召回", "value", ragStatus2, "status", "empty".equals(ragStatus2) ? "warn" : "ok")
            ),
            dataEvidenceItems,
            calls2,
            buildUserSummary(dataStatus, dataSummary, ragContext2.isEmpty() ? "通过配置校验器直接检查" : "参考数据规范", dataStatus.equals("warning") ? "样例不足会导致后续无法为 AI/标注员提供有效的 Few-Shot 提示，影响启动准确率" : "", dataResult.findings().isEmpty() ? "" : "请返回 [数据上传] 步骤补充更多样例，或修复字段为空的数据", ragStatus2),
            dataStatus.equals("warning") ? "high" : "low",
            dataStatus.equals("warning") ? "样例不足会导致后续无法为 AI/标注员提供有效的 Few-Shot 提示，影响启动准确率" : "",
            dataResult.findings().isEmpty() ? "无需动作" : "补充样例",
            "upload",
            dataResult.findings().isEmpty() ? "" : "请返回 [数据上传] 步骤补充更多样例，或修复字段为空的数据",
            ragStatus2, 0, countToolCalls(calls2), 0
        );

        businessNodes.add(new BusinessNode(traceId + "_bn_2", "sample_data", "样例数据", dataStatus, dataSummary, ragContext2.isEmpty() ? "通过配置校验器直接检查" : "参考数据规范", dataStatus.equals("warning") ? "数据不足可能影响 AI 生成质量" : "", dataResult.findings().isEmpty() ? "" : "补充更多样例或修复空字段", ragContext2.isEmpty() ? List.of() : List.of("数据规范"), "upload", node2Duration, dataDetails));
        traceNodes.add(buildAgentExecutionNode(traceId + "_tn_2", agent2, "sample_data", 2, "样例数据校验", dataStatus, node2Duration, request, ragInfo2, List.of(), List.of(), List.of(), List.of(dataResult), List.of(), dataSummary));
        recordRagMetrics(agent2, "sample_data", ragContext2, ragDuration2, taskId, traceId);
        if (ragContext2.isBlank()) agentMetrics.recordRagRunEmpty(agent2, "sample_data", taskId);
        recordSandboxMetrics(agent2, "sample_data", dataResult, taskId, traceId);
        recordExecutionMetrics(agent2, "sample_data", dataStatus, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("sample_data", "agent_execution", node2Duration);

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
        List<SkillRegistryService.SkillExecutionResult> schemaSkillResults = new ArrayList<>();
        for (var skill : schemaSkills) {
            var sr = skillRegistryService.executeSkill(skill, schemaCtx);
            schemaSkillResults.add(sr);
            schemaFindings.addAll(sr.findings());
        }
        long node3Duration = System.currentTimeMillis() - nodeStart;

        int compCount = request.schemaComponents() != null ? request.schemaComponents().size() : 0;
        if (ragContext3.isBlank()) ragEmptyCount++;
        String schemaStatus = schemaResult.exitCode() == 0 && compCount > 0 && schemaFindings.stream().noneMatch(f -> "high".equals(f.severity())) ? "success" : "warning";
        String schemaSummary = compCount == 0 ? "缺少标注模板组件"
            : (sentimentTask ? TaskSemanticAnalyzer.schemaSentimentSummary(request.schemaComponents())
                : String.format("%d 个标注组件，%s", compCount, schemaResult.findings().isEmpty() ? "与样例映射正确" : schemaResult.findings().get(0)));
        String ragStatus3 = ragContext3.isBlank() ? "empty" : "hit";
        List<Map<String, Object>> compEvidence = schemaComponentEvidence(request.schemaComponents());
        Map<String, Object> ragInfo3 = buildRagInfoForNode(request, "annotation_template", ragDuration3);
        Map<String, Object> skillInfo3 = buildSkillInfo(schemaSkills, schemaFindings, schemaSkillResults);
        List<Map<String, Object>> spans3 = buildAllSpans(traceId, "annotation_template", "schema_generator", ragInfo3, schemaSkills, schemaSkillResults, List.of(schemaResult), List.of());
        Map<String, Object> calls3 = buildCallsEnvelope(ragInfo3, skillInfo3, List.of(sandboxToCall(schemaResult, "tool")), List.of(), List.of(), spans3);
        List<Map<String, Object>> schemaEvidenceItems = new ArrayList<>(Stream.concat(
            compEvidence.stream(),
            schemaFindings.stream().map(f -> Map.<String, Object>of("type", "skill_finding", "label", f.skillName(), "value", f.description(), "source", "skill"))
        ).toList());
        if (sentimentTask) schemaEvidenceItems.addAll(TaskSemanticAnalyzer.schemaSentimentEvidence(request.schemaComponents()));

        Map<String, Object> schemaDetails = buildStructuredDetails(
            agent3, "annotation_template", traceId, schemaStatus,
            List.of(
                Map.of("label", "组件数量", "value", compCount, "status", compCount > 0 ? "ok" : "fail"),
                Map.of("label", "Skill 覆盖", "value", schemaSkills.size(), "status", "ok")
            ),
            List.of(
                Map.of("label", "组件数", "expected", "> 0", "operator", "gt"),
                Map.of("label", "无高危 Skill finding", "expected", "0 high", "operator", "eq")
            ),
            List.of(
                Map.of("label", "有效组件", "value", compCount, "status", compCount > 0 ? "ok" : "fail"),
                Map.of("label", "沙盒 exitCode", "value", schemaResult.exitCode(), "status", schemaResult.exitCode() == 0 ? "ok" : "fail"),
                Map.of("label", "RAG 召回", "value", ragStatus3, "status", "empty".equals(ragStatus3) ? "warn" : "ok")
            ),
            schemaEvidenceItems,
            calls3,
            buildUserSummary(schemaStatus, schemaSummary, ragContext3.isEmpty() ? "基于通用组件规范" : "参考模板规范", schemaStatus.equals("warning") ? "模板残缺或字段未映射会导致标注页无法正确渲染表单，前端无法收集结果" : "", schemaFindings.isEmpty() ? "" : schemaFindings.get(0).suggestion(), ragStatus3),
            schemaStatus.equals("warning") ? "high" : "low",
            schemaStatus.equals("warning") ? "模板残缺或字段未映射会导致标注页无法正确渲染表单，前端无法收集结果" : "",
            schemaFindings.isEmpty() ? "无需动作" : "修复模板",
            "template",
            schemaFindings.isEmpty() ? "" : schemaFindings.get(0).suggestion(),
            ragStatus3, schemaSkills.size(), countToolCalls(calls3), 0
        );

        businessNodes.add(new BusinessNode(traceId + "_bn_3", "annotation_template", "标注模板", schemaStatus, schemaSummary, ragContext3.isEmpty() ? "基于通用组件规范" : "参考模板规范", schemaStatus.equals("warning") ? "模板不完整会导致标注员无法正确提交" : "", schemaFindings.isEmpty() ? "" : schemaFindings.get(0).suggestion(), ragContext3.isEmpty() ? List.of() : List.of("模板规范"), "template", node3Duration, schemaDetails));
        traceNodes.add(buildAgentExecutionNode(traceId + "_tn_3", agent3, "annotation_template", 3, "标注模板校验", schemaStatus, node3Duration, request, ragInfo3, schemaSkills, schemaSkillResults, schemaFindings, List.of(schemaResult), List.of(), schemaSummary));
        recordRagMetrics(agent3, "annotation_template", ragContext3, ragDuration3, taskId, traceId);
        if (ragContext3.isBlank()) agentMetrics.recordRagRunEmpty(agent3, "annotation_template", taskId);
        recordSkillMetrics(agent3, "annotation_template", schemaSkills, schemaFindings, taskId, traceId);
        recordSandboxMetrics(agent3, "annotation_template", schemaResult, taskId, traceId);
        recordExecutionMetrics(agent3, "annotation_template", schemaStatus, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("annotation_template", "agent_execution", node3Duration);

        // Node 4: Quality Rules Check
        String agent4 = NODE_AGENT_MAP.get("quality_rules");
        nodeStart = System.currentTimeMillis();
        long ragStart4 = System.currentTimeMillis();
        String ragContext4 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "rubric_generator");
        long ragDuration4 = System.currentTimeMillis() - ragStart4;
        var rubricResult = sandboxService.executeRubricCheck(traceId, request.rubricRules() != null ? request.rubricRules() : List.of(), request.rubricDimensions() != null ? request.rubricDimensions() : List.of());
        long node4Duration = System.currentTimeMillis() - nodeStart;

        int ruleCount = request.rubricRules() != null ? request.rubricRules().size() : 0;
        if (ragContext4.isBlank()) ragEmptyCount++;
        String rubricStatus = rubricResult.exitCode() == 0 && ruleCount > 0 ? "success" : "warning";
        String rubricSummary = ruleCount == 0 ? "缺少质检规则"
            : (sentimentTask ? String.format("%d 条规则，覆盖原文引用/不得臆测/混合情感等情感分类质检要点", ruleCount)
                : String.format("%d 条质检规则，%s", ruleCount, rubricResult.findings().isEmpty() ? "已覆盖目标维度" : rubricResult.findings().get(0)));
        String ragStatus4 = ragContext4.isBlank() ? "empty" : "hit";
        List<Map<String, Object>> ruleEvidence = rubricRuleEvidence(request.rubricRules());
        Map<String, Object> ragInfo4 = buildRagInfoForNode(request, "quality_rules", ragDuration4);
        Map<String, Object> skillInfo4 = buildSkillInfo(List.of(), List.of());
        List<Map<String, Object>> spans4 = buildAllSpans(traceId, "quality_rules", "rubric_generator", ragInfo4, List.of(), List.of(), List.of(rubricResult), List.of());
        Map<String, Object> calls4 = buildCallsEnvelope(ragInfo4, skillInfo4, List.of(sandboxToCall(rubricResult, "tool")), List.of(), List.of(), spans4);
        List<Map<String, Object>> rubricEvidenceItems = new ArrayList<>(Stream.concat(
            ruleEvidence.stream(),
            rubricResult.findings().stream().map(f -> Map.<String, Object>of("type", "sandbox_finding", "label", "finding", "value", f, "source", "rubric_check"))
        ).toList());
        if (sentimentTask) rubricEvidenceItems.addAll(TaskSemanticAnalyzer.rubricSentimentEvidence(request.rubricRules()));

        Map<String, Object> rubricDetails = buildStructuredDetails(
            agent4, "quality_rules", traceId, rubricStatus,
            List.of(
                Map.of("label", "规则条数", "value", ruleCount, "status", ruleCount > 0 ? "ok" : "fail"),
                Map.of("label", "评分维度", "value", request.rubricDimensions() != null ? request.rubricDimensions().size() : 0, "status", "ok")
            ),
            List.of(
                Map.of("label", "规则数", "expected", "> 0", "operator", "gt"),
                Map.of("label", "沙盒校验", "expected", "exitCode=0", "operator", "eq")
            ),
            List.of(
                Map.of("label", "实际规则", "value", ruleCount, "status", ruleCount > 0 ? "ok" : "fail"),
                Map.of("label", "沙盒 exitCode", "value", rubricResult.exitCode(), "status", rubricResult.exitCode() == 0 ? "ok" : "fail"),
                Map.of("label", "RAG 召回", "value", ragStatus4, "status", "empty".equals(ragStatus4) ? "warn" : "ok")
            ),
            rubricEvidenceItems,
            calls4,
            buildUserSummary(rubricStatus, rubricSummary, ragContext4.isEmpty() ? "通用规则检查" : "参考质检规范", rubricStatus.equals("warning") ? "缺乏量化的规则会导致机器和人工质检都失去标准，模型预标注的质量无法评估" : "", rubricResult.findings().isEmpty() ? "" : "返回 [质检规则] 步骤补充维度和规则描述", ragStatus4),
            rubricStatus.equals("warning") ? "high" : "low",
            rubricStatus.equals("warning") ? "缺乏量化的规则会导致机器和人工质检都失去标准，模型预标注的质量无法评估" : "",
            rubricResult.findings().isEmpty() ? "无需动作" : "补充规则",
            "rules",
            rubricResult.findings().isEmpty() ? "" : "返回 [质检规则] 步骤补充维度和规则描述",
            ragStatus4, 0, countToolCalls(calls4), 0
        );

        businessNodes.add(new BusinessNode(traceId + "_bn_4", "quality_rules", "质检规则", rubricStatus, rubricSummary, ragContext4.isEmpty() ? "通用规则检查" : "参考质检规范", rubricStatus.equals("warning") ? "缺少规则可能导致审核无标准" : "", rubricResult.findings().isEmpty() ? "" : "补充质检规则和评分维度", ragContext4.isEmpty() ? List.of() : List.of("质检规则"), "rules", node4Duration, rubricDetails));
        traceNodes.add(buildAgentExecutionNode(traceId + "_tn_4", agent4, "quality_rules", 4, "质检规则校验", rubricStatus, node4Duration, request, ragInfo4, List.of(), List.of(), List.of(), List.of(rubricResult), List.of(), rubricSummary));
        recordRagMetrics(agent4, "quality_rules", ragContext4, ragDuration4, taskId, traceId);
        if (ragContext4.isBlank()) agentMetrics.recordRagRunEmpty(agent4, "quality_rules", taskId);
        recordSandboxMetrics(agent4, "quality_rules", rubricResult, taskId, traceId);
        recordExecutionMetrics(agent4, "quality_rules", rubricStatus, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("quality_rules", "agent_execution", node4Duration);

        // Node 5: Comprehensive Assessment
        String agent5 = NODE_AGENT_MAP.get("comprehensive_assessment");
        nodeStart = System.currentTimeMillis();
        long ragStart5 = System.currentTimeMillis();
        String ragContext5 = knowledgeBaseService.buildRagContextForNode(request.taskName(), request.instruction(), "critic");
        long ragDuration5 = System.currentTimeMillis() - ragStart5;
        if (ragContext5.isBlank()) ragEmptyCount++;
        boolean hasAll = compCount > 0 && ruleCount > 0 && sampleCount >= 3;
        long node5Duration = System.currentTimeMillis() - nodeStart;

        List<String> issues = new ArrayList<>();
        if (compCount == 0) issues.add("缺少标注模板");
        if (ruleCount == 0) issues.add("缺少质检规则");
        if (sampleCount < 3) issues.add("样例不足 3 条");
        String assessStatus = hasAll ? "success" : "warning";
        String assessSummary = TaskSemanticAnalyzer.assessmentSentimentSummary(request, hasAll, ragEmptyCount, issues);
        String ragStatus5 = ragContext5.isBlank() ? "empty" : "hit";
        List<Map<String, Object>> depMatrix = List.of(
            Map.of("label", "task_description", "value", instrStatus, "status", "success".equals(instrStatus) ? "ok" : "fail"),
            Map.of("label", "sample_data", "value", dataStatus, "status", "success".equals(dataStatus) ? "ok" : "fail"),
            Map.of("label", "annotation_template", "value", schemaStatus, "status", "success".equals(schemaStatus) ? "ok" : "fail"),
            Map.of("label", "quality_rules", "value", rubricStatus, "status", "success".equals(rubricStatus) ? "ok" : "fail")
        );
        Map<String, Object> ragInfo5 = buildRagInfoForNode(request, "comprehensive_assessment", ragDuration5);
        Map<String, Object> skillInfo5 = buildSkillInfo(List.of(), List.of());
        List<Map<String, Object>> spans5 = buildAllSpans(traceId, "comprehensive_assessment", "critic", ragInfo5, List.of(), List.of(), List.of(), List.of());
        Map<String, Object> calls5 = buildCallsEnvelope(ragInfo5, skillInfo5, List.of(), List.of(), List.of(), spans5);

        Map<String, Object> assessDetails = buildStructuredDetails(
            agent5, "comprehensive_assessment", traceId, assessStatus,
            List.of(Map.of("label", "上游依赖节点", "value", 4, "status", "ok")),
            List.of(Map.of("label", "前置节点", "expected", "all success", "operator", "eq")),
            depMatrix,
            issues.stream().map(i -> Map.<String, Object>of("type", "dependency_gap", "label", "未满足", "value", i, "source", "upstream")).toList(),
            calls5,
            buildUserSummary(assessStatus, assessSummary, ragContext5.isEmpty() ? "静态聚合" : "参考评分标准", hasAll ? "" : "不完整的配置可能影响标注质量和效率", issues.isEmpty() ? "" : "修复: " + String.join("、", issues), ragStatus5),
            hasAll ? "low" : "high",
            hasAll ? "" : "强行发布将会进入残缺状态，B/C端不可见",
            hasAll ? "进入发布准备" : "修复上游",
            "publish",
            hasAll ? "可以进行最终封装" : "修复: " + String.join("、", issues),
            ragStatus5, 0, 0, 0
        );

        businessNodes.add(new BusinessNode(traceId + "_bn_5", "comprehensive_assessment", "综合评估", assessStatus, assessSummary, ragContext5.isEmpty() ? "静态聚合" : "参考评分标准", hasAll ? "" : "不完整的配置可能影响标注质量和效率", issues.isEmpty() ? "" : "修复: " + String.join("、", issues), ragContext5.isEmpty() ? List.of() : List.of("项目要求"), "publish", node5Duration, assessDetails));
        traceNodes.add(buildAgentExecutionNode(traceId + "_tn_5", agent5, "comprehensive_assessment", 5, "综合评估", assessStatus, node5Duration, request, ragInfo5, List.of(), List.of(), List.of(), List.of(), List.of(), assessSummary));
        recordRagMetrics(agent5, "comprehensive_assessment", ragContext5, ragDuration5, taskId, traceId);
        if (ragContext5.isBlank()) agentMetrics.recordRagRunEmpty(agent5, "comprehensive_assessment", taskId);
        recordExecutionMetrics(agent5, "comprehensive_assessment", assessStatus, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("comprehensive_assessment", "agent_execution", node5Duration);

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
            Map<String, Object> probe = mcpGateway.probeToCallMap(traceId, server);
            mcpProbeResults.add(probe);
            String mcpStatus = server.available() ? "available" : "unavailable";
            agentMetrics.recordMcpCall(agent6, "publish_readiness", server.name(), "probe", mcpStatus, taskId, traceId);
        }

        Map<String, Object> ragInfo6 = buildRagInfo(request.taskName(), request.instruction(), "task_package_writer", 0);
        List<Map<String, Object>> spans6 = buildAllSpans(traceId, "publish_readiness", "task_package_writer", ragInfo6, List.of(), List.of(), List.of(pkgResult), mcpProbeResults);
        Map<String, Object> calls6 = buildCallsEnvelope(ragInfo6, buildSkillInfo(List.of(), List.of()), List.of(sandboxToCall(pkgResult, "tool")), List.of(), mcpProbeResults, spans6);

        Map<String, Object> pkgDetails = buildStructuredDetails(
            agent6, "publish_readiness", traceId, pkgStatus,
            List.of(
                Map.of("label", "TaskPackage.taskId", "value", request.taskId(), "status", "ok"),
                Map.of("label", "TaskPackage.taskName", "value", request.taskName(), "status", request.taskName() != null && !request.taskName().isBlank() ? "ok" : "fail"),
                Map.of("label", "MCP 探测", "value", mcpCount, "status", mcpCount > 0 ? "ok" : "warn")
            ),
            List.of(
                Map.of("label", "契约校验", "expected", "exitCode=0", "operator", "eq"),
                Map.of("label", "上游综合评估", "expected", "success", "operator", "eq")
            ),
            List.of(
                Map.of("label", "沙盒 exitCode", "value", pkgResult.exitCode(), "status", pkgResult.exitCode() == 0 ? "ok" : "fail"),
                Map.of("label", "上游就绪", "value", hasAll, "status", hasAll ? "ok" : "fail")
            ),
            Stream.concat(
                pkgResult.findings().stream().map(f -> Map.<String, Object>of("type", "contract", "label", "finding", "value", f, "source", "package_check")),
                mcpProbeResults.stream().map(m -> Map.<String, Object>of("type", "mcp_probe", "label", m.get("server"), "value", m.get("status"), "source", "mcp"))
            ).toList(),
            calls6,
            buildUserSummary(pkgStatus, pkgSummary, "下游 API 契约协议", pkgStatus.equals("warning") ? "不完整的任务包无法被 B/C 模块正确消费" : "", pkgResult.findings().isEmpty() ? "" : pkgResult.findings().get(0), "n/a"),
            pkgStatus.equals("warning") ? "high" : "low",
            pkgStatus.equals("warning") ? "下游 B/C 端解析报错，导致任务不可见" : "",
            pkgStatus.equals("warning") ? "重试或反馈" : "完成",
            "publish",
            pkgStatus.equals("warning") ? "通常是服务异常，请重试或反馈给技术" : "完成",
            "n/a", 0, countToolCalls(calls6), mcpCount
        );

        businessNodes.add(new BusinessNode(traceId + "_bn_6", "publish_readiness", "发布准备", pkgStatus, pkgSummary, "下游 API 契约协议", pkgStatus.equals("warning") ? "不完整的任务包无法被 B/C 模块正确消费" : "", pkgResult.findings().isEmpty() ? "" : pkgResult.findings().get(0), List.of(), "publish", node6Duration, pkgDetails));
        traceNodes.add(buildAgentExecutionNode(traceId + "_tn_6", agent6, "publish_readiness", 6, "发布准备校验", pkgStatus, node6Duration, request, ragInfo6, List.of(), List.of(), List.of(), List.of(pkgResult), mcpProbeResults, pkgSummary));
        recordSandboxMetrics(agent6, "publish_readiness", pkgResult, taskId, traceId);
        recordExecutionMetrics(agent6, "publish_readiness", pkgStatus, taskId, traceId);
        agentMetrics.recordAuditNodeDuration("publish_readiness", "agent_execution", node6Duration);

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
        agentMetrics.recordTraceRun(overallStatus, completeness.complete(), taskId);
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
        } else {
            long executionGroups = developer.stream().filter(n -> "agent_execution".equals(n.type())).count();
            if (executionGroups > 0 && executionGroups < 6) {
                missing.add("developer_trace_groups");
            } else if (executionGroups == 0 && developer.size() < 6) {
                missing.add("developer_trace");
            }
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
