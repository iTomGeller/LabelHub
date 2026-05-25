"use client";

import { useState } from "react";

export interface BusinessNode {
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
  isCacheValid?: boolean;
  traceId?: string;
  onForceRerun: () => void;
  onJumpToStep?: (step: string) => void;
}

const FIX_STEP_LABELS: Record<string, string> = {
  upload: "数据上传",
  template: "配置模板",
  rules: "质检规则",
  publish: "确认发布",
};

function statusColor(status: string) {
  return status === "success"
    ? { ring: "ring-success/30", bg: "bg-success/10", text: "text-success", dot: "bg-success" }
    : { ring: "ring-warning/40", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" };
}

function NodeDrawer({
  node,
  onClose,
  onJumpToStep,
}: {
  node: BusinessNode;
  onClose: () => void;
  onJumpToStep?: (step: string) => void;
}) {
  const colors = statusColor(node.status);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-14 bottom-0 z-50 w-full max-w-md overflow-y-auto border-l border-primary/10 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-primary/10 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold text-ink/40">审核节点详情</p>
            <h4 className="text-lg font-bold text-primary">{node.title}</h4>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink/50 hover:bg-surface">关闭</button>
        </div>
        <div className="space-y-5 p-5">
          <div className={`rounded-xl p-4 ring-2 ${colors.ring} ${colors.bg}`}>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
              <span className={`text-sm font-bold ${colors.text}`}>
                {node.status === "success" ? "通过" : "需关注"}
              </span>
              <span className="ml-auto text-xs text-ink/40 font-mono">{node.durationMs}ms</span>
            </div>
            <p className="mt-2 text-sm text-primary">{node.summary}</p>
          </div>

          <section>
            <p className="text-xs font-bold text-ink/40 mb-1">检查了什么</p>
            <p className="text-sm text-ink/80">{node.summary}</p>
          </section>

          {node.evidence && (
            <section>
              <p className="text-xs font-bold text-ink/40 mb-1">参考依据</p>
              <p className="text-sm text-ink/70 bg-surface/60 rounded-lg p-3">{node.evidence}</p>
            </section>
          )}

          {node.impact && (
            <section>
              <p className="text-xs font-bold text-ink/40 mb-1">为什么影响发布</p>
              <p className="text-sm text-warning bg-warning/5 rounded-lg p-3">{node.impact}</p>
            </section>
          )}

          {node.suggestion && (
            <section>
              <p className="text-xs font-bold text-ink/40 mb-1">建议怎么修</p>
              <p className="text-sm text-ink/70">{node.suggestion}</p>
            </section>
          )}

          {node.referenceSources.length > 0 && node.referenceSources[0] !== "" && (
            <section>
              <p className="text-xs font-bold text-ink/40 mb-1">参考知识</p>
              <div className="flex flex-wrap gap-1">
                {node.referenceSources.map((src, i) => (
                  <span key={i} className="text-[10px] bg-accent/5 text-accent border border-accent/10 rounded px-2 py-0.5">{src}</span>
                ))}
              </div>
            </section>
          )}

          {node.status !== "success" && node.fixStep && onJumpToStep && (
            <button
              onClick={() => onJumpToStep(node.fixStep)}
              className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white hover:bg-accent/90"
            >
              前往修复：{FIX_STEP_LABELS[node.fixStep] || node.fixStep} →
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

export function AuditBusinessDag({
  nodes,
  loading,
  fromCache,
  isCacheValid,
  traceId,
  onForceRerun,
  onJumpToStep,
}: Props) {
  const [selectedNode, setSelectedNode] = useState<BusinessNode | null>(null);

  const passedCount = nodes.filter(n => n.status === "success").length;
  const allPassed = nodes.length > 0 && passedCount === nodes.length;
  const totalMs = nodes.reduce((s, n) => s + n.durationMs, 0);

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-primary">AI 质量审核</h3>
          <p className="text-xs text-ink/50">任务质量 DAG：检查了什么、依据是什么、为什么影响发布、怎么修</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fromCache && isCacheValid !== false && (
            <span className="text-[10px] text-success/70 bg-success/5 border border-success/10 rounded px-2 py-0.5">已使用上次审核结果</span>
          )}
          {traceId && (
            <a
              href={`/?view=trace&traceId=${encodeURIComponent(traceId)}`}
              className="rounded-xl border border-primary/15 px-3 py-2 text-xs font-bold text-primary hover:bg-surface/50"
            >
              查看开发者 Trace
            </a>
          )}
          <button
            onClick={onForceRerun}
            disabled={loading}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              loading ? "bg-accent/50 text-white cursor-wait" : "border border-accent/30 text-accent hover:bg-accent/5"
            }`}
          >
            {loading ? "审核中…" : "手动重新审核"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-8 flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          <p className="text-sm text-ink/50">AI 正在从多个维度评估您的任务配置…</p>
        </div>
      )}

      {nodes.length > 0 && !loading && (
        <div className="space-y-4">
          <div className="rounded-xl bg-surface/40 p-4 flex flex-wrap items-center gap-4">
            <span className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold shrink-0 ${allPassed ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
              {passedCount}/{nodes.length}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary">{allPassed ? "审核通过，可以安全发布" : "部分维度需要关注"}</p>
              <p className="text-xs text-ink/40">共 {nodes.length} 项检查，{passedCount} 项合格，耗时 {(totalMs / 1000).toFixed(1)} 秒</p>
            </div>
          </div>

          {/* Horizontal DAG — desktop */}
          <div className="hidden lg:block overflow-x-auto pb-2">
            <div className="flex items-stretch gap-0 min-w-max px-2">
              {nodes.map((node, idx) => {
                const c = statusColor(node.status);
                const refCount = node.referenceSources.filter(s => s && s !== "").length;
                return (
                  <div key={node.id} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedNode(node)}
                      className={`relative w-36 rounded-xl border-2 p-3 text-left transition hover:shadow-md ${
                        selectedNode?.id === node.id ? "border-accent ring-2 ring-accent/20" : "border-primary/10"
                      } ${c.bg}`}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
                        <span className="text-[10px] font-bold text-ink/40">步骤 {idx + 1}</span>
                      </div>
                      <p className="text-xs font-bold text-primary leading-tight">{node.title}</p>
                      <p className="mt-1 text-[10px] text-ink/50 line-clamp-2">{node.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-1 text-[9px] text-ink/40">
                        <span>{node.durationMs}ms</span>
                        {refCount > 0 && <span>· {refCount} 条知识</span>}
                      </div>
                      <p className={`mt-1 text-[10px] font-bold ${c.text}`}>{node.status === "success" ? "通过" : "需关注"}</p>
                    </button>
                    {idx < nodes.length - 1 && (
                      <div className="flex items-center px-1 text-ink/25" aria-hidden>
                        <svg className="h-4 w-8" viewBox="0 0 32 16" fill="none">
                          <path d="M0 8h24M24 8l-6-5M24 8l-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vertical DAG — mobile / tablet */}
          <div className="lg:hidden space-y-0">
            {nodes.map((node, idx) => {
              const c = statusColor(node.status);
              return (
                <div key={node.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${c.bg} ${c.text}`}>
                      {idx + 1}
                    </div>
                    {idx < nodes.length - 1 && <div className="w-px flex-1 min-h-[12px] bg-primary/15 my-1" />}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(node)}
                    className={`flex-1 mb-3 rounded-xl border px-4 py-3 text-left ${c.bg} border-primary/10`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-primary">{node.title}</span>
                      <span className={`text-xs font-bold ${c.text}`}>{node.status === "success" ? "通过" : "需关注"}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink/60 line-clamp-2">{node.summary}</p>
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-ink/40 text-center">点击节点查看证据、影响与修复建议</p>
        </div>
      )}

      {selectedNode && (
        <NodeDrawer
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onJumpToStep={onJumpToStep}
        />
      )}
    </div>
  );
}
