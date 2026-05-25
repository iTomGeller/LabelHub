"use client";

import { useState } from "react";

interface TraceNode {
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

interface Props {
  nodes: TraceNode[];
  traceId: string;
}

const TYPE_COLORS: Record<string, string> = {
  agent: "border-purple-200 bg-purple-50 text-purple-800",
  prompt: "border-blue-200 bg-blue-50 text-blue-800",
  rag: "border-emerald-200 bg-emerald-50 text-emerald-800",
  skill: "border-orange-200 bg-orange-50 text-orange-800",
  mcp: "border-cyan-200 bg-cyan-50 text-cyan-800",
  tool: "border-amber-200 bg-amber-50 text-amber-800",
  sandbox: "border-rose-200 bg-rose-50 text-rose-800",
  handoff: "border-indigo-200 bg-indigo-50 text-indigo-800",
};

const TYPE_LABELS: Record<string, string> = {
  agent: "Agent",
  prompt: "Prompt",
  rag: "RAG",
  skill: "Skills",
  mcp: "MCP",
  tool: "Tools",
  sandbox: "Sandbox",
  handoff: "Handoff",
};

const SWIMLANE_ORDER = ["agent", "prompt", "rag", "skill", "tool", "sandbox", "mcp", "handoff"];

function normalizeType(type: string) {
  if (type === "sandbox") return "sandbox";
  if (type === "tool") return "tool";
  return type;
}

export function AgentTraceDag({ nodes, traceId }: Props) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const grouped = SWIMLANE_ORDER.reduce<Record<string, TraceNode[]>>((acc, lane) => {
    acc[lane] = nodes.filter(n => normalizeType(n.type) === lane);
    return acc;
  }, {});

  const visibleLanes = filter === "all"
    ? SWIMLANE_ORDER.filter(l => (grouped[l]?.length ?? 0) > 0)
    : SWIMLANE_ORDER.filter(l => l === filter && (grouped[l]?.length ?? 0) > 0);

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <h3 className="text-lg font-bold text-primary">Agent 执行 Trace DAG</h3>
        <p className="text-xs text-ink/50 font-mono break-all">traceId: {traceId}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === "all" ? "bg-accent text-white" : "bg-surface text-ink/60"}`}
        >
          全部 ({nodes.length})
        </button>
        {SWIMLANE_ORDER.map(l => {
          const count = grouped[l]?.length ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={l}
              onClick={() => setFilter(l)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === l ? "bg-accent text-white" : "bg-surface text-ink/60"}`}
            >
              {TYPE_LABELS[l]} ({count})
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {visibleLanes.length === 0 && (
          <p className="text-center py-8 text-sm text-ink/40">暂无执行记录</p>
        )}
        {visibleLanes.map(lane => (
          <div key={lane} className="rounded-xl border border-primary/10 overflow-hidden">
            <div className={`px-4 py-2 text-xs font-bold border-b ${TYPE_COLORS[lane] || "bg-surface"}`}>
              {TYPE_LABELS[lane] || lane} 泳道 · {grouped[lane].length} 节点
            </div>
            <div className="flex flex-wrap gap-2 p-3 bg-white">
              {grouped[lane].map((node, idx) => (
                <div key={node.id} className="flex items-center gap-1 min-w-0">
                  {idx > 0 && <span className="text-ink/20 text-xs">→</span>}
                  <button
                    type="button"
                    onClick={() => setExpandedNode(expandedNode === node.id ? null : node.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition max-w-[200px] ${
                      expandedNode === node.id ? "border-accent ring-2 ring-accent/20" : "border-primary/10 hover:border-accent/30"
                    }`}
                  >
                    <p className="font-bold text-primary truncate">{node.title}</p>
                    <p className="text-[10px] text-ink/40 font-mono">{node.durationMs}ms · {node.status}</p>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {expandedNode && (() => {
        const node = nodes.find(n => n.id === expandedNode);
        if (!node) return null;
        return (
          <div className="rounded-xl border border-accent/20 bg-surface/30 p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-primary">{node.title}</span>
              <button onClick={() => setExpandedNode(null)} className="text-ink/40 hover:text-primary">收起</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><span className="text-ink/40">类型</span><p className="font-mono">{node.type}</p></div>
              <div><span className="text-ink/40">状态</span><p className={node.status === "success" ? "text-success" : "text-warning"}>{node.status}</p></div>
              <div><span className="text-ink/40">耗时</span><p className="font-mono">{node.durationMs}ms</p></div>
            </div>
            {node.rag && Boolean((node.rag as Record<string, unknown>).hasContent) && (
              <div>
                <span className="text-ink/40 font-bold">RAG 召回</span>
                <p className="mt-1 bg-emerald-50 rounded p-2 font-mono text-[11px] whitespace-pre-wrap break-words">
                  {String((node.rag as Record<string, unknown>).context || "").substring(0, 400)}
                </p>
              </div>
            )}
            {node.skill && Boolean((node.skill as Record<string, unknown>).used) && (
              <div>
                <span className="text-ink/40 font-bold">Skills</span>
                <p className="mt-1">{((node.skill as Record<string, unknown>).skills as string[] || []).join(", ")}</p>
              </div>
            )}
            {node.sandbox && (
              <pre className="bg-rose-50 rounded p-2 overflow-x-auto">{JSON.stringify(node.sandbox, null, 2)}</pre>
            )}
            {node.mcp && (
              <pre className="bg-cyan-50 rounded p-2 overflow-x-auto">{JSON.stringify(node.mcp, null, 2)}</pre>
            )}
          </div>
        );
      })()}
    </div>
  );
}
