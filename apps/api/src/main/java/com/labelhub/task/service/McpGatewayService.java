package com.labelhub.task.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class McpGatewayService {
    private static final Logger log = LoggerFactory.getLogger(McpGatewayService.class);

    private final JdbcTemplate jdbc;

    public McpGatewayService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record McpServer(String name, String description, List<String> tools, boolean available) {}
    public record McpCallResult(String server, String tool, String status, long durationMs, Object output, String error) {}

    private static final List<McpServer> REGISTRY = List.of(
        new McpServer("feishu-docs", "飞书文档导入：将飞书任务要求/规范导入知识库", List.of("import_doc", "list_docs"), false),
        new McpServer("github-sync", "GitHub 文档同步：同步 contracts、README、过程文档", List.of("sync_repo", "fetch_file"), false),
        new McpServer("knowledge-import", "外部知识源导入：接入企业词表和规范", List.of("import_glossary", "import_spec"), false)
    );

    public List<McpServer> listServers() {
        return REGISTRY;
    }

    public McpCallResult call(String traceId, String serverName, String toolName, Map<String, Object> input) {
        long start = System.currentTimeMillis();

        McpServer server = REGISTRY.stream()
            .filter(s -> s.name().equals(serverName))
            .findFirst()
            .orElse(null);

        if (server == null) {
            return recordAndReturn(traceId, serverName, toolName, "error", 0, null, "MCP server '" + serverName + "' not found in registry");
        }

        if (!server.available()) {
            long duration = System.currentTimeMillis() - start;
            return recordAndReturn(traceId, serverName, toolName, "unavailable", duration, null, "MCP server '" + serverName + "' is registered but not currently connected");
        }

        if (!server.tools().contains(toolName)) {
            long duration = System.currentTimeMillis() - start;
            return recordAndReturn(traceId, serverName, toolName, "error", duration, null, "Tool '" + toolName + "' not found on server '" + serverName + "'");
        }

        long duration = System.currentTimeMillis() - start;
        return recordAndReturn(traceId, serverName, toolName, "unavailable", duration, null, "MCP server not connected in current environment");
    }

    public List<McpCallResult> getCallsForTrace(String traceId) {
        return jdbc.query(
            "SELECT server_name, tool_name, status, duration_ms, error_message FROM mcp_call_logs WHERE trace_id = ? ORDER BY created_at",
            (rs, i) -> new McpCallResult(
                rs.getString("server_name"), rs.getString("tool_name"),
                rs.getString("status"), rs.getLong("duration_ms"),
                null, rs.getString("error_message")
            ),
            traceId
        );
    }

    private McpCallResult recordAndReturn(String traceId, String server, String tool, String status, long durationMs, Object output, String error) {
        String id = "mcp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            jdbc.update(
                "INSERT INTO mcp_call_logs (id, trace_id, server_name, tool_name, status, duration_ms, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)",
                id, traceId, server, tool, status, durationMs, error
            );
        } catch (Exception e) {
            log.warn("Failed to persist MCP call log: {}", e.getMessage());
        }
        return new McpCallResult(server, tool, status, durationMs, output, error);
    }
}
