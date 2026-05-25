export const AGENT_EXECUTION_ORDER = [
  { agent: "task_context_builder", nodeKey: "task_description", title: "任务说明", sequence: 1 },
  { agent: "dataset_sampler", nodeKey: "sample_data", title: "样例数据", sequence: 2 },
  { agent: "schema_generator", nodeKey: "annotation_template", title: "标注模板", sequence: 3 },
  { agent: "rubric_generator", nodeKey: "quality_rules", title: "质检规则", sequence: 4 },
  { agent: "critic", nodeKey: "comprehensive_assessment", title: "综合评估", sequence: 5 },
  { agent: "task_package_writer", nodeKey: "publish_readiness", title: "发布准备", sequence: 6 },
] as const;

export interface TraceNode {
  id: string;
  type: string;
  title: string;
  status: string;
  durationMs: number;
  inputPreview?: unknown;
  outputPreview?: unknown;
  prompt?: Record<string, unknown>;
  rag?: Record<string, unknown>;
  skill?: Record<string, unknown>;
  mcp?: Record<string, unknown>;
  sandbox?: Record<string, unknown>;
  children?: string[];
}

export interface AgentExecutionGroup {
  agent: string;
  nodeKey: string;
  title: string;
  sequence: number;
  status: string;
  durationMs: number;
  traceNodeId: string;
  calls: {
    rag?: Record<string, unknown> | undefined;
    skills?: Record<string, unknown> | undefined;
    tools?: Record<string, unknown>[];
    sandbox?: Record<string, unknown>[];
    mcp?: Record<string, unknown>[];
  };
  raw?: TraceNode;
}

const LEGACY_NODE_MAP: Record<string, { agent: string; nodeKey: string; title: string; sequence: number }> = {
  _tn_1: AGENT_EXECUTION_ORDER[0],
  _tn_2: AGENT_EXECUTION_ORDER[1],
  _tn_3: AGENT_EXECUTION_ORDER[2],
  _tn_4: AGENT_EXECUTION_ORDER[3],
  _tn_5: AGENT_EXECUTION_ORDER[4],
  _tn_6: AGENT_EXECUTION_ORDER[5],
};

function suffix(id: string) {
  const idx = id.lastIndexOf("_tn_");
  return idx >= 0 ? id.substring(idx) : id;
}

function emptyCalls(): AgentExecutionGroup["calls"] {
  return { tools: [], sandbox: [], mcp: [] };
}

export function groupTraceNodes(nodes: TraceNode[]): AgentExecutionGroup[] {
  const executionNodes = nodes.filter((n) => n.type === "agent_execution");
  if (executionNodes.length > 0) {
    return executionNodes
      .map((node) => {
        const out = (node.outputPreview || {}) as Record<string, unknown>;
        const calls = (out.calls as AgentExecutionGroup["calls"]) || emptyCalls();
        return {
          agent: String(out.agent || ""),
          nodeKey: String(out.nodeKey || ""),
          title: node.title,
          sequence: Number(out.sequence || 0),
          status: node.status,
          durationMs: node.durationMs,
          traceNodeId: node.id,
          calls,
          raw: node,
        };
      })
      .sort((a, b) => a.sequence - b.sequence);
  }

  const groups = AGENT_EXECUTION_ORDER.map((meta) => ({
    ...meta,
    status: "success",
    durationMs: 0,
    traceNodeId: "",
    calls: emptyCalls(),
    raw: undefined as TraceNode | undefined,
  }));

  for (const node of nodes) {
    const key = suffix(node.id);
    const meta = LEGACY_NODE_MAP[key];
    if (!meta) continue;
    const group = groups.find((g) => g.nodeKey === meta.nodeKey);
    if (!group) continue;
    group.traceNodeId = group.traceNodeId || node.id;
    group.durationMs += node.durationMs;
    if (node.status !== "success") group.status = node.status;
    group.raw = node;
    if (node.rag) group.calls.rag = node.rag;
    if (node.skill) group.calls.skills = node.skill;
    if (node.sandbox) {
      if (node.type === "sandbox") group.calls.sandbox!.push(node.sandbox);
      else group.calls.tools!.push(node.sandbox);
    }
    if (node.mcp) group.calls.mcp!.push(node.mcp);
  }

  return groups.filter((g) => g.traceNodeId || g.durationMs > 0);
}

export function groupHasRisk(group: AgentExecutionGroup): boolean {
  if (group.status !== "success") return true;
  const rag = group.calls.rag as Record<string, unknown> | undefined;
  if (rag && rag.hasContent === false) return true;
  const skills = group.calls.skills as Record<string, unknown> | undefined;
  if (skills && Number(skills.findingCount || 0) > 0) return true;
  const tools = group.calls.tools || [];
  if (tools.some((t) => t.status && t.status !== "success")) return true;
  const mcp = group.calls.mcp || [];
  if (mcp.some((m) => m.status === "unavailable")) return true;
  return false;
}

export function groupMatchesFilter(group: AgentExecutionGroup, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "risk") return groupHasRisk(group);
  if (filter === "rag_empty") {
    const rag = group.calls.rag as Record<string, unknown> | undefined;
    return Boolean(rag && rag.hasContent === false);
  }
  if (filter === "tool_error") {
    return (group.calls.tools || []).some((t) => t.status && t.status !== "success")
      || (group.calls.sandbox || []).some((t) => t.status && t.status !== "success");
  }
  if (filter === "mcp_error") {
    return (group.calls.mcp || []).some((m) => m.status === "unavailable");
  }
  if (filter === "skill_findings") {
    const skills = group.calls.skills as Record<string, unknown> | undefined;
    return Boolean(skills && Number(skills.findingCount || 0) > 0);
  }
  return true;
}
