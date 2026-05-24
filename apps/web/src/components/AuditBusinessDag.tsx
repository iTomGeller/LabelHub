"use client";

import { useState } from "react";

interface BusinessNode {
  id: string;
  nodeKey: string;
  title: string;
  status: string;
  summary: string;
  evidence: string;
  impact: string;
  suggestion: string;
  referenceSources: string[];
  fixStep: string;
  durationMs: number;
}

interface Props {
  nodes: BusinessNode[];
  loading: boolean;
  fromCache: boolean;
  onForceRerun: () => void;
  onJumpToStep?: (step: string) => void;
}

export function AuditBusinessDag({ nodes, loading, fromCache, onForceRerun, onJumpToStep }: Props) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const passedCount = nodes.filter(n => n.status === "success").length;
  const allPassed = nodes.length > 0 && passedCount === nodes.length;
  const totalMs = nodes.reduce((s, n) => s + n.durationMs, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-primary">AI 质量审核</h3>
          <p className="text-xs text-ink/50">基于知识库和规则对任务配置进行多维度评估</p>
        </div>
        <div className="flex items-center gap-2">
          {fromCache && <span className="text-[10px] text-success/70 bg-success/5 border border-success/10 rounded px-2 py-0.5">已使用缓存结果</span>}
          <button onClick={onForceRerun} disabled={loading} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${loading ? "bg-accent/50 text-white cursor-wait" : fromCache ? "border border-accent/30 text-accent hover:bg-accent/5" : "bg-accent text-white hover:bg-accent/90"}`}>
            {loading ? "审核中…" : fromCache ? "手动重新审核" : "开始审核"}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-8 flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          <p className="text-sm text-ink/50">AI 正在从多个维度评估您的任务配置…</p>
        </div>
      )}

      {/* Results */}
      {nodes.length > 0 && !loading && (
        <div className="space-y-4">
          {/* Score Summary */}
          <div className="rounded-xl bg-surface/40 p-4 flex items-center gap-4">
            <span className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${allPassed ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
              {passedCount}/{nodes.length}
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold text-primary">{allPassed ? "审核通过，可以安全发布" : "部分维度需要关注"}</p>
              <p className="text-xs text-ink/40">共 {nodes.length} 项检查，{passedCount} 项合格，耗时 {(totalMs / 1000).toFixed(1)} 秒</p>
            </div>
          </div>

          {/* DAG Flow Visualization */}
          <div className="relative">
            {nodes.map((node, idx) => (
              <div key={node.id} className="relative">
                {/* Connector Line */}
                {idx > 0 && (
                  <div className="absolute left-[19px] -top-2 h-2 w-px bg-primary/15" />
                )}

                {/* Node Card */}
                <button
                  onClick={() => setExpandedNode(expandedNode === node.id ? null : node.id)}
                  className={`w-full text-left rounded-xl px-4 py-3 mb-2 transition-all ${
                    node.status === "success" ? "bg-success/5 hover:bg-success/10" : "bg-warning/5 border border-warning/15 hover:bg-warning/10"
                  } ${expandedNode === node.id ? "ring-2 ring-accent/30" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      node.status === "success" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                    }`}>
                      {node.status === "success" ? "\u2713" : "!"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-primary">{node.title}</span>
                      <p className="text-xs text-ink/60 truncate">{node.summary}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${node.status === "success" ? "text-success" : "text-warning"}`}>
                      {node.status === "success" ? "通过" : "需关注"}
                    </span>
                    <svg className={`h-4 w-4 text-ink/30 transition-transform ${expandedNode === node.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Detail Drawer */}
                {expandedNode === node.id && (
                  <div className="ml-11 mb-3 rounded-xl border border-primary/10 bg-white p-4 space-y-3 shadow-sm">
                    <div>
                      <p className="text-xs font-bold text-ink/40 mb-1">检查结果</p>
                      <p className="text-sm text-primary">{node.summary}</p>
                    </div>

                    {node.evidence && (
                      <div>
                        <p className="text-xs font-bold text-ink/40 mb-1">参考依据</p>
                        <p className="text-sm text-ink/70">{node.evidence}</p>
                      </div>
                    )}

                    {node.impact && (
                      <div>
                        <p className="text-xs font-bold text-ink/40 mb-1">影响</p>
                        <p className="text-sm text-warning">{node.impact}</p>
                      </div>
                    )}

                    {node.suggestion && (
                      <div>
                        <p className="text-xs font-bold text-ink/40 mb-1">建议</p>
                        <p className="text-sm text-ink/70">{node.suggestion}</p>
                      </div>
                    )}

                    {node.referenceSources.length > 0 && node.referenceSources[0] !== "" && (
                      <div>
                        <p className="text-xs font-bold text-ink/40 mb-1">知识来源</p>
                        <div className="flex flex-wrap gap-1">
                          {node.referenceSources.map((src, i) => (
                            <span key={i} className="text-[10px] bg-accent/5 text-accent border border-accent/10 rounded px-2 py-0.5">{src}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {node.status === "warning" && node.fixStep && onJumpToStep && (
                      <button
                        onClick={() => onJumpToStep(node.fixStep)}
                        className="rounded-lg bg-accent/10 text-accent px-3 py-1.5 text-xs font-bold hover:bg-accent/20 transition"
                      >
                        前往修复 →
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
