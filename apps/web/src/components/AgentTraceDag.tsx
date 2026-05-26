"use client";

import { useState } from "react";
import {
  groupTraceNodes,
  groupHasRisk,
  groupMatchesFilter,
  type AgentExecutionGroup,
  type TraceNode,
} from "@/lib/traceExecution";
import { CallReportPanel, CallSummaryChips } from "./CallReportPanel";
import { DagCanvas, BUSINESS_DAG_LAYOUT, BUSINESS_DAG_EDGES } from "./DagCanvas";

interface Props {
  nodes: TraceNode[];
  traceId: string;
  runStatus?: string;
  traceCompleteness?: boolean;
}

const FILTER_OPTIONS = [
  { key: "all", label: "全部" },
  { key: "risk", label: "有风险" },
  { key: "rag_empty", label: "RAG 空召回" },
  { key: "tool_error", label: "Tool 异常" },
  { key: "mcp_error", label: "MCP 异常" },
  { key: "skill_findings", label: "Skill findings" },
] as const;

const NODE_KEY_TO_LAYOUT: Record<string, string> = {
  task_description: "task_description",
  sample_data: "sample_data",
  annotation_template: "annotation_template",
  quality_rules: "quality_rules",
  comprehensive_assessment: "comprehensive_assessment",
  publish_readiness: "publish_readiness",
};

function statusBadge(status: string) {
  if (status === "success") return "bg-success/10 text-success border-success/20";
  if (status === "warning") return "bg-warning/10 text-warning border-warning/20";
  return "bg-danger/10 text-danger border-danger/20";
}

function emptyStateMessage(runStatus?: string, traceCompleteness?: boolean, groupCount?: number) {
  if (runStatus === "running") {
    return { title: "审核仍在运行", detail: "Agent 执行组将在审核完成后写入，请稍后刷新。" };
  }
  if (groupCount === 0 && runStatus === "partial") {
    return { title: "Trace 保存失败", detail: "运行时产生了结果但数据库持久化失败，请重新执行审核。" };
  }
  if (groupCount === 0) {
    return { title: "Trace 执行组为空", detail: "未找到 Agent 执行组，可能是旧版数据或持久化异常。" };
  }
  if (traceCompleteness === false) {
    return { title: "Trace 不完整", detail: "部分 Agent 执行组缺失，请查看上方完整性提示。" };
  }
  return { title: "暂无匹配执行组", detail: "当前筛选条件下没有可展示的 Agent 执行组。" };
}

export function AgentTraceDag({ nodes, traceId, runStatus, traceCompleteness }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const groups = groupTraceNodes(nodes);
  const visibleGroups = groups.filter((g) => groupMatchesFilter(g, filter));
  const visibleKeys = new Set(visibleGroups.map((g) => g.nodeKey));
  const visibleEdges = BUSINESS_DAG_EDGES.filter((e) => visibleKeys.has(e.from) && visibleKeys.has(e.to));
  const emptyMsg = emptyStateMessage(runStatus, traceCompleteness, groups.length);
  const riskCount = groups.filter(groupHasRisk).length;
  const ragEmptyCount = groups.filter((g) => groupMatchesFilter(g, "rag_empty")).length;
  const expanded = groups.find((g) => g.traceNodeId === expandedGroup) || null;

  function AgentCard({ group }: { group: AgentExecutionGroup }) {
    const layoutId = NODE_KEY_TO_LAYOUT[group.nodeKey] || group.nodeKey;
    const layout = BUSINESS_DAG_LAYOUT.find((l) => l.id === layoutId);
    if (!layout) return null;

    return (
      <button
        type="button"
        onClick={() => setExpandedGroup(expandedGroup === group.traceNodeId ? null : group.traceNodeId)}
        className={`absolute w-[180px] rounded-xl border border-primary/10 bg-white p-3 text-left transition hover:shadow-md ${
          expandedGroup === group.traceNodeId ? "border-accent ring-2 ring-accent/20" : ""
        }`}
        style={{ left: layout.x, top: layout.y }}
      >
        <div className="flex items-start gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
            {group.sequence}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs font-bold text-primary truncate">{group.title}</span>
              <span className={`rounded border px-1 py-0.5 text-[9px] font-bold ${statusBadge(group.status)}`}>{group.status}</span>
            </div>
            <p className="text-[9px] font-mono text-ink/40 truncate">{group.agent}</p>
            <p className="text-[9px] text-ink/40">{group.durationMs}ms</p>
            <div className="mt-2">
              <CallSummaryChips calls={group.calls as Record<string, unknown>} />
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <h3 className="text-lg font-bold text-primary">Agent 执行 Trace DAG</h3>
        <p className="text-xs text-ink/50">6 个 Agent 执行节点，RAG / Skill / Tool / Sandbox / MCP 绑定在对应 Agent 内部</p>
        <p className="text-xs text-ink/50 font-mono break-all mt-1">traceId: {traceId}</p>
      </div>

      {ragEmptyCount > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning">
          知识库未命中：{ragEmptyCount} 个 Agent RAG 空召回，当前审核基于静态规则，置信度低
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {FILTER_OPTIONS.map((opt) => {
          const count = opt.key === "all" ? groups.length
            : opt.key === "risk" ? riskCount
            : groups.filter((g) => groupMatchesFilter(g, opt.key)).length;
          return (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === opt.key ? "bg-accent text-white" : "bg-surface text-ink/60"}`}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {visibleGroups.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-sm font-bold text-ink/60">{emptyMsg.title}</p>
          <p className="text-xs text-ink/40 max-w-md mx-auto">{emptyMsg.detail}</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <DagCanvas width={800} height={440} nodes={BUSINESS_DAG_LAYOUT} edges={visibleEdges}>
            {visibleGroups.map((group) => (
              <AgentCard key={group.traceNodeId || group.nodeKey} group={group} />
            ))}
          </DagCanvas>
        </div>
      )}

      {expanded && (
        <div className="rounded-xl border border-accent/20 bg-surface/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-bold text-primary">{expanded.title}</span>
              <p className="text-[10px] font-mono text-ink/40">{expanded.agent} · {expanded.nodeKey} · seq {expanded.sequence}</p>
            </div>
            <button onClick={() => setExpandedGroup(null)} className="text-ink/40 hover:text-primary shrink-0">收起</button>
          </div>
          <CallReportPanel calls={expanded.calls as Record<string, unknown>} title="Agent 内部执行调用" />
        </div>
      )}
    </div>
  );
}
