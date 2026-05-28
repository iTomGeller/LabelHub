"use client";

import { useEffect, useMemo, useState } from "react";
import { agentLabel, nodeLabel } from "@/lib/diagnosticLabels";
import { KeyValueViewer } from "./KeyValueViewer";
import { Pagination, paginateSlice } from "./Pagination";

export interface InternalGraphNode {
  id: string;
  type: string;
  title: string;
  inputPreview?: Record<string, unknown>;
  outputPreview?: Record<string, unknown>;
}

export interface InternalGraphEdge {
  from: string;
  to: string;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; dot: string }> = {
  prompt: { bg: "bg-indigo-50", border: "border-indigo-200", dot: "bg-indigo-400" },
  decision: { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400" },
  rag: { bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-400" },
  skill: { bg: "bg-sky-50", border: "border-sky-200", dot: "bg-sky-400" },
  mcp: { bg: "bg-violet-50", border: "border-violet-200", dot: "bg-violet-400" },
  tool: { bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-400" },
  sandbox: { bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-400" },
  output: { bg: "bg-success/10", border: "border-success/30", dot: "bg-success" },
};

const TYPE_ZH: Record<string, string> = {
  prompt: "Prompt 输入",
  decision: "决策轮次",
  rag: "RAG 检索",
  skill: "Skill 执行",
  mcp: "MCP 探测",
  tool: "工具调用",
  sandbox: "沙盒检查",
  output: "Agent 输出",
};

const CALL_TYPES = new Set(["rag", "skill", "mcp", "tool", "sandbox"]);
const NODES_PER_PAGE = 8;

function laneForType(type: string): number {
  switch (type) {
    case "prompt": return 0;
    case "decision": return 1;
    case "rag":
    case "skill":
    case "mcp":
    case "tool":
    case "sandbox": return 2;
    case "output": return 3;
    default: return 2;
  }
}

function defaultSelectedNodeId(nodes: InternalGraphNode[]): string | null {
  const callNode = nodes.find((n) => CALL_TYPES.has(n.type));
  if (callNode) return callNode.id;
  const decision = nodes.find((n) => n.type === "decision");
  if (decision) return decision.id;
  const output = nodes.find((n) => n.type === "output");
  if (output) return output.id;
  return nodes[0]?.id ?? null;
}

interface Props {
  internalGraph?: {
    nodes?: InternalGraphNode[];
    edges?: InternalGraphEdge[];
    businessNode?: string;
  };
  decisionSteps?: Record<string, unknown>[];
  compact?: boolean;
}

export function AgentInternalGraph({ internalGraph, decisionSteps = [], compact }: Props) {
  const nodes = useMemo(() => internalGraph?.nodes ?? [], [internalGraph?.nodes]);
  const edges = useMemo(() => internalGraph?.edges ?? [], [internalGraph?.edges]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodePage, setNodePage] = useState(1);
  const [decisionPage, setDecisionPage] = useState(1);

  useEffect(() => {
    setSelectedId(defaultSelectedNodeId(nodes));
    setNodePage(1);
    setDecisionPage(1);
  }, [nodes]);

  const selected = nodes.find((n) => n.id === selectedId) || null;

  const layout = useMemo(() => {
    const laneCounts = [0, 0, 0, 0];
    return nodes.map((n) => {
      const lane = laneForType(n.type);
      const idx = laneCounts[lane]++;
      return { ...n, lane, idx, x: lane * 180 + 20, y: idx * 88 + 16 };
    });
  }, [nodes]);

  const width = 760;
  const height = Math.max(200, ...layout.map((l) => l.y + 72), 160);
  const nodePaged = paginateSlice(layout, nodePage, NODES_PER_PAGE);
  const decisionPaged = paginateSlice(decisionSteps, decisionPage, 3);

  if (!nodes.length) {
    return (
      <div className="rounded-xl border border-primary/10 bg-surface/30 p-6 text-center text-sm text-ink/50">
        暂无内部执行子图（可能是旧版 Trace 数据）
      </div>
    );
  }

  const visibleIds = new Set(nodePaged.items.map((n) => n.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-primary">Agent 执行子图</p>
          {!compact && internalGraph?.businessNode && (
            <p className="text-[10px] text-ink/50">负责业务维度：{nodeLabel(internalGraph.businessNode)}</p>
          )}
        </div>
        <Pagination page={nodePaged.page} totalPages={nodePaged.totalPages} onPageChange={setNodePage} label="子图节点" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="overflow-x-auto rounded-xl border border-primary/10 bg-white p-4 min-w-0">
          <svg width={width} height={height} className="min-w-[640px]">
            <defs>
              <marker id="ig-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const from = layout.find((n) => n.id === e.from);
              const to = layout.find((n) => n.id === e.to);
              if (!from || !to || !visibleIds.has(from.id) || !visibleIds.has(to.id)) return null;
              const x1 = from.x + 140;
              const y1 = from.y + 28;
              const x2 = to.x;
              const y2 = to.y + 28;
              return (
                <line
                  key={`${e.from}-${e.to}-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  markerEnd="url(#ig-arrow)"
                />
              );
            })}
            {nodePaged.items.map((n) => {
              const style = TYPE_STYLES[n.type] || TYPE_STYLES.tool;
              const active = selectedId === n.id;
              return (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`} className="cursor-pointer" onClick={() => setSelectedId(n.id)}>
                  <rect
                    width={140}
                    height={56}
                    rx={12}
                    className={`${style.bg} ${active ? "stroke-accent stroke-2" : style.border}`}
                    fill="white"
                    strokeWidth={active ? 2 : 1}
                  />
                  <circle cx={12} cy={14} r={4} className={style.dot} fill="currentColor" />
                  <text x={22} y={16} className="text-[9px] fill-slate-400 font-bold">{TYPE_ZH[n.type] || n.type}</text>
                  <text x={12} y={34} className="text-[10px] fill-slate-800 font-bold">{n.title.length > 14 ? n.title.slice(0, 14) + "…" : n.title}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {selected && (
          <div className="rounded-xl border border-accent/20 bg-surface/30 p-4 space-y-3 lg:sticky lg:top-4 lg:self-start max-h-[420px] overflow-y-auto">
            <p className="text-sm font-bold text-primary">{TYPE_ZH[selected.type] || selected.type}</p>
            <p className="text-xs text-ink/60">{selected.title}</p>
            {selected.inputPreview && (
              <div>
                <p className="text-[10px] font-bold text-ink/40 mb-1">输入</p>
                <KeyValueViewer data={selected.inputPreview} />
              </div>
            )}
            {selected.outputPreview && (
              <div>
                <p className="text-[10px] font-bold text-ink/40 mb-1">输出</p>
                <KeyValueViewer data={selected.outputPreview} />
              </div>
            )}
          </div>
        )}
      </div>

      {decisionSteps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-primary">决策轮次</p>
            <Pagination page={decisionPaged.page} totalPages={decisionPaged.totalPages} onPageChange={setDecisionPage} label="决策轮次" />
          </div>
          <div className="space-y-2">
            {decisionPaged.items.map((step, i) => (
              <div key={String(step.id || i)} className="rounded-xl border border-primary/10 bg-white p-3 space-y-1">
                <p className="text-sm font-bold text-primary">{String(step.title || "决策")}</p>
                {step.why != null && <p className="text-xs text-ink/60"><span className="font-bold">为什么：</span>{String(step.why)}</p>}
                {step.result != null && <p className="text-xs text-ink/70"><span className="font-bold">结果：</span>{String(step.result)}</p>}
                {step.nextAction != null && <p className="text-xs text-accent"><span className="font-bold">下一步：</span>{String(step.nextAction)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function extractInternalGraph(raw?: Record<string, unknown>) {
  const out = (raw?.outputPreview || raw) as Record<string, unknown>;
  return {
    promptPreview: out.promptPreview as Record<string, unknown> | undefined,
    decisionSteps: (out.decisionSteps as Record<string, unknown>[]) || [],
    internalGraph: out.internalGraph as Props["internalGraph"],
    businessMapping: out.businessMapping as Record<string, unknown> | undefined,
    agentId: String(out.agent || ""),
    agentName: agentLabel(String(out.agent || "")),
  };
}
