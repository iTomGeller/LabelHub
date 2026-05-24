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
  agent: "bg-purple-100 text-purple-700 border-purple-200",
  prompt: "bg-blue-100 text-blue-700 border-blue-200",
  rag: "bg-emerald-100 text-emerald-700 border-emerald-200",
  skill: "bg-orange-100 text-orange-700 border-orange-200",
  mcp: "bg-cyan-100 text-cyan-700 border-cyan-200",
  tool: "bg-amber-100 text-amber-700 border-amber-200",
  sandbox: "bg-rose-100 text-rose-700 border-rose-200",
  handoff: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

const TYPE_LABELS: Record<string, string> = {
  agent: "Agent",
  prompt: "Prompt",
  rag: "RAG",
  skill: "Skill",
  mcp: "MCP",
  tool: "Tool",
  sandbox: "Sandbox",
  handoff: "Handoff",
};

const ALL_TYPES = ["all", "agent", "prompt", "rag", "skill", "mcp", "tool", "sandbox", "handoff"];

export function AgentTraceDag({ nodes, traceId }: Props) {
  const [filter, setFilter] = useState("all");
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const filtered = filter === "all" ? nodes : nodes.filter(n => n.type === filter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-primary">Agent 执行 Trace</h3>
          <p className="text-xs text-ink/50 font-mono">traceId: {traceId}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1">
        {ALL_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              filter === t ? "bg-accent text-white" : "bg-surface text-ink/60 hover:bg-surface/80"
            }`}
          >
            {t === "all" ? "全部" : TYPE_LABELS[t] || t} {t !== "all" && `(${nodes.filter(n => n.type === t).length})`}
          </button>
        ))}
      </div>

      {/* Trace Timeline */}
      <div className="space-y-2">
        {filtered.map((node, idx) => (
          <div key={node.id} className="relative">
            {idx > 0 && <div className="absolute left-4 -top-1 h-1 w-px bg-primary/10" />}

            <button
              onClick={() => setExpandedNode(expandedNode === node.id ? null : node.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-all hover:shadow-sm ${
                expandedNode === node.id ? "ring-2 ring-accent/20 border-accent/30" : "border-primary/10"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold rounded px-2 py-0.5 border ${TYPE_COLORS[node.type] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                  {TYPE_LABELS[node.type] || node.type}
                </span>
                <span className="text-sm font-bold text-primary flex-1">{node.title}</span>
                <span className="text-[10px] text-ink/40 font-mono">{node.durationMs}ms</span>
                <span className={`h-2 w-2 rounded-full ${node.status === "success" ? "bg-success" : node.status === "warning" ? "bg-warning" : "bg-danger"}`} />
              </div>
            </button>

            {expandedNode === node.id && (
              <div className="ml-6 mt-1 mb-2 rounded-xl border border-primary/10 bg-white p-4 space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-ink/40 font-bold">类型</span>
                    <p className="font-mono text-primary">{node.type}</p>
                  </div>
                  <div>
                    <span className="text-ink/40 font-bold">状态</span>
                    <p className={node.status === "success" ? "text-success" : "text-warning"}>{node.status}</p>
                  </div>
                  <div>
                    <span className="text-ink/40 font-bold">耗时</span>
                    <p className="font-mono">{node.durationMs}ms</p>
                  </div>
                </div>

                {node.rag && Boolean((node.rag as Record<string, unknown>).hasContent) && (
                  <div>
                    <span className="text-ink/40 font-bold">RAG 召回</span>
                    <p className="mt-1 text-ink/70 bg-emerald-50 rounded p-2 font-mono text-[11px] whitespace-pre-wrap">
                      {String((node.rag as Record<string, unknown>).context || "").substring(0, 300)}
                    </p>
                  </div>
                )}

                {node.skill && Boolean((node.skill as Record<string, unknown>).used) && (
                  <div>
                    <span className="text-ink/40 font-bold">Skills 参与</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {((node.skill as Record<string, unknown>).skills as string[] || []).map((s: string) => (
                        <span key={s} className="bg-orange-50 text-orange-700 rounded px-2 py-0.5 text-[10px] font-mono">{s}</span>
                      ))}
                    </div>
                    <p className="text-ink/50 mt-1">发现 {String((node.skill as Record<string, unknown>).findingCount || 0)} 条结论</p>
                  </div>
                )}

                {node.sandbox && (
                  <div>
                    <span className="text-ink/40 font-bold">Sandbox 执行</span>
                    <pre className="mt-1 bg-rose-50 rounded p-2 font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(node.sandbox, null, 2)}
                    </pre>
                  </div>
                )}

                {node.mcp && (
                  <div>
                    <span className="text-ink/40 font-bold">MCP 调用</span>
                    <pre className="mt-1 bg-cyan-50 rounded p-2 font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(node.mcp, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-center py-8 text-sm text-ink/40">
            {filter === "all" ? "暂无执行记录" : `暂无 ${TYPE_LABELS[filter] || filter} 类型的节点`}
          </p>
        )}
      </div>
    </div>
  );
}
