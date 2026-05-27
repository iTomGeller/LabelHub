"use client";

import { useMemo, useState } from "react";
import {
  groupTraceNodes,
  groupMatchesFilter,
  type AgentExecutionGroup,
  type TraceNode,
} from "@/lib/traceExecution";
import { DagCanvas, useNarrowScreen } from "./DagCanvas";
import { PagedRawJson, TraceCallGraph, TraceSpanTimeline } from "./TraceSpanTimeline";
import {
  BUSINESS_DAG_EDGES,
  BUSINESS_DAG_LANE_LABELS,
  computeBusinessDagLayout,
  computeVerticalDagLayout,
  DEFAULT_NODE_H,
  DEFAULT_NODE_W,
  LANE_GUTTER_W,
} from "@/lib/dagLayout";
import { agentLabel, statusLabelZh } from "@/lib/diagnosticLabels";
import { flattenCalls } from "@/lib/callReport";

interface Props {
  nodes: TraceNode[];
  traceId: string;
  runStatus?: string;
  traceCompleteness?: boolean;
  compact?: boolean;
}

const FILTER_OPTIONS = [
  { key: "all", label: "全部" },
  { key: "risk", label: "有风险" },
  { key: "rag_empty", label: "空召回" },
  { key: "tool_error", label: "工具异常" },
  { key: "mcp_error", label: "MCP 异常" },
  { key: "skill_findings", label: "技能发现" },
] as const;

const DAG_ORDER = [
  "task_description",
  "sample_data",
  "annotation_template",
  "quality_rules",
  "comprehensive_assessment",
  "publish_readiness",
];

type PanelTab = "io" | "chain" | "waterfall" | "raw";

function statusBadge(status: string) {
  if (status === "success") return "bg-success/10 text-success border-success/20";
  if (status === "warning") return "bg-warning/10 text-warning border-warning/20";
  return "bg-danger/10 text-danger border-danger/20";
}

function emptyStateMessage(runStatus?: string, traceCompleteness?: boolean, groupCount?: number) {
  if (runStatus === "running") return { title: "审核仍在运行", detail: "完成后将写入 Trace。" };
  if (groupCount === 0 && runStatus === "partial") return { title: "Trace 保存失败", detail: "请重新执行审核。" };
  if (groupCount === 0) return { title: "Trace 为空", detail: "可能是旧版数据或持久化异常。" };
  if (traceCompleteness === false) return { title: "Trace 不完整", detail: "部分 Agent 缺失。" };
  return { title: "暂无匹配节点", detail: "调整筛选条件后重试。" };
}

export function AgentTraceDag({ nodes, traceId, runStatus, traceCompleteness, compact }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [panelTab, setPanelTab] = useState<PanelTab>("io");
  const [spanPage, setSpanPage] = useState(1);
  const narrow = useNarrowScreen();

  const groups = groupTraceNodes(nodes);
  const visibleGroups = groups.filter((g) => groupMatchesFilter(g, filter));
  const visibleKeys = new Set(visibleGroups.map((g) => g.nodeKey));
  const visibleEdges = BUSINESS_DAG_EDGES.filter((e) => visibleKeys.has(e.from) && visibleKeys.has(e.to));
  const emptyMsg = emptyStateMessage(runStatus, traceCompleteness, groups.length);
  const ragEmptyCount = groups.filter((g) => groupMatchesFilter(g, "rag_empty")).length;
  const expanded = groups.find((g) => g.traceNodeId === expandedGroup) || null;

  const baseLayout = useMemo(() => {
    if (narrow) return computeVerticalDagLayout(DAG_ORDER, DEFAULT_NODE_W, DEFAULT_NODE_H);
    return computeBusinessDagLayout(DEFAULT_NODE_W, DEFAULT_NODE_H);
  }, [narrow]);

  const layout = baseLayout.layout.filter((l) => visibleKeys.has(l.id));
  const edges = narrow
    ? layout.slice(0, -1).map((l, i) => ({ from: layout[i].id, to: layout[i + 1].id }))
    : visibleEdges;

  function AgentCard({ group, layoutItem }: { group: AgentExecutionGroup; layoutItem: { x: number; y: number; width?: number } }) {
    const nw = layoutItem.width ?? DEFAULT_NODE_W;
    const rag = group.calls.rag as Record<string, unknown> | undefined;
    const spanCount = flattenCalls(group.calls as Record<string, unknown>).length;

    return (
      <button
        type="button"
        onClick={() => {
          setExpandedGroup(expandedGroup === group.traceNodeId ? null : group.traceNodeId);
          setPanelTab("io");
          setSpanPage(1);
        }}
        className={`absolute rounded-2xl border bg-white p-4 text-left transition hover:shadow-lg ${
          expandedGroup === group.traceNodeId ? "border-accent ring-2 ring-accent/20" : "border-primary/10"
        }`}
        style={{ left: layoutItem.x, top: layoutItem.y, width: nw, minHeight: DEFAULT_NODE_H }}
      >
        <div className="flex items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">{group.sequence}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1 mb-1">
              <span className="text-sm font-bold text-primary">{group.title}</span>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${statusBadge(group.status)}`}>{statusLabelZh(group.status)}</span>
            </div>
            <p className="text-[10px] text-ink/50">{agentLabel(group.agent)} · {group.durationMs}ms · {spanCount} 个 span</p>
            {rag && rag.hasContent === false && (
              <p className="text-[10px] text-warning mt-1">{String(rag.emptyReason || "RAG 空召回")}</p>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className={`min-w-0 ${compact ? "space-y-3" : "space-y-4"}`}>
      {!compact && (
        <div>
          <h3 className="text-lg font-bold text-primary">Trace 排障工作台</h3>
          <p className="text-xs text-ink/50">主链路 6 Agent · 选中后查看输入输出、调用链与耗时瀑布</p>
        </div>
      )}

      {ragEmptyCount > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning">
          {ragEmptyCount} 处空召回 — 关注降级传播：RAG 空 → 静态规则 → 低置信
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {FILTER_OPTIONS.map((opt) => {
          const count = opt.key === "all" ? groups.length : groups.filter((g) => groupMatchesFilter(g, opt.key)).length;
          return (
            <button key={opt.key} onClick={() => setFilter(opt.key)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === opt.key ? "bg-accent text-white" : "bg-surface text-ink/60"}`}>
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {visibleGroups.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-sm font-bold text-ink/60">{emptyMsg.title}</p>
          <p className="text-xs text-ink/40">{emptyMsg.detail}</p>
        </div>
      ) : (
        <div className={`grid gap-4 ${expanded && !narrow ? "lg:grid-cols-[1fr_420px]" : ""}`}>
          <div className="overflow-x-auto pb-2 min-w-0">
            <DagCanvas
              width={baseLayout.width}
              height={baseLayout.height}
              nodes={layout}
              edges={edges}
              nodeWidth={DEFAULT_NODE_W}
              nodeHeight={DEFAULT_NODE_H}
              laneLabels={narrow ? undefined : BUSINESS_DAG_LANE_LABELS}
              laneGutter={narrow ? 0 : LANE_GUTTER_W}
              markerPrefix="trace"
            >
              {visibleGroups.map((group) => {
                const layoutItem = layout.find((l) => l.id === group.nodeKey);
                if (!layoutItem) return null;
                return <AgentCard key={group.traceNodeId || group.nodeKey} group={group} layoutItem={layoutItem} />;
              })}
            </DagCanvas>
          </div>

          {expanded && (
            <div className="rounded-xl border border-accent/20 bg-surface/30 p-4 space-y-4 lg:sticky lg:top-20 lg:self-start max-h-[85vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-primary">{expanded.title}</span>
                  <p className="text-[10px] text-ink/50">{agentLabel(expanded.agent)} · 第 {expanded.sequence} 步 · trace {traceId.slice(0, 12)}…</p>
                </div>
                <button type="button" onClick={() => setExpandedGroup(null)} className="text-ink/40 hover:text-primary shrink-0 text-xs">收起</button>
              </div>

              <div className="flex flex-wrap gap-1">
                {([
                  ["io", "输入输出"],
                  ["chain", "调用链"],
                  ["waterfall", "耗时瀑布"],
                  ["raw", "原始数据"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPanelTab(key)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${panelTab === key ? "bg-accent text-white" : "bg-white text-ink/50"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {panelTab === "io" && <TraceCallGraph group={expanded} />}
              {panelTab === "chain" && <TraceSpanTimeline group={expanded} page={spanPage} onPageChange={setSpanPage} />}
              {panelTab === "waterfall" && <TraceSpanTimeline group={expanded} page={spanPage} onPageChange={setSpanPage} />}
              {panelTab === "raw" && <PagedRawJson data={expanded.raw || expanded.calls} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
