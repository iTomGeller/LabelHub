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
  details?: Record<string, unknown>;
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

const NODE_AGENT_LABELS: Record<string, string> = {
  task_description: "task_context_builder",
  sample_data: "dataset_sampler",
  annotation_template: "schema_generator",
  quality_rules: "rubric_generator",
  comprehensive_assessment: "critic",
  publish_readiness: "task_package_writer",
};

function statusColor(status: string) {
  return status === "success"
    ? { ring: "ring-success/30", bg: "bg-success/10", text: "text-success", dot: "bg-success" }
    : { ring: "ring-warning/40", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" };
}

function riskLevel(node: BusinessNode): "low" | "medium" | "high" {
  if (node.status !== "success") return "high";
  const ragStatus = node.details?.ragStatus;
  if (ragStatus === "empty") return "medium";
  return "low";
}

function NodeDrawer({
  node,
  traceId,
  onClose,
  onJumpToStep,
}: {
  node: BusinessNode;
  traceId?: string;
  onClose: () => void;
  onJumpToStep?: (step: string) => void;
}) {
  const colors = statusColor(node.status);
  const agent = String(node.details?.agent || NODE_AGENT_LABELS[node.nodeKey] || "unknown");
  const ragStatus = String(node.details?.ragStatus || "unknown");
  const skillCount = Number(node.details?.skillCount ?? 0);
  const toolCallCount = Number(node.details?.toolCallCount ?? 0);
  const mcpCount = Number(node.details?.mcpCount ?? 0);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-14 bottom-0 z-50 w-full max-w-md overflow-y-auto border-l border-primary/10 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-primary/10 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold text-ink/40">审核节点详情</p>
            <h4 className="text-lg font-bold text-primary">{node.title}</h4>
            <p className="text-[10px] font-mono text-ink/40 mt-0.5">{agent} · {node.nodeKey}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink/50 hover:bg-surface">关闭</button>
        </div>
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-surface/50 p-2">
              <span className="text-ink/40">Agent</span>
              <p className="font-mono text-primary truncate">{agent}</p>
            </div>
            <div className="rounded-lg bg-surface/50 p-2">
              <span className="text-ink/40">Node</span>
              <p className="font-mono text-primary truncate">{node.nodeKey}</p>
            </div>
            {traceId && (
              <div className="col-span-2 rounded-lg bg-surface/50 p-2">
                <span className="text-ink/40">Trace ID</span>
                <p className="font-mono text-primary break-all text-[10px]">{traceId}</p>
              </div>
            )}
          </div>

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

          {node.details ? (
            <div className="space-y-4">
              <section>
                <p className="text-xs font-bold text-ink/40 mb-1">检查对象</p>
                <p className="text-sm text-ink/80">{String(node.details.checkedItems || "-")}</p>
              </section>
              <section>
                <p className="text-xs font-bold text-ink/40 mb-1">判定规则</p>
                <p className="text-sm text-ink/80">{String(node.details.criteria || "-")}</p>
              </section>
              <section>
                <p className="text-xs font-bold text-ink/40 mb-1">实际结果</p>
                <p className="text-sm text-ink/80">{String(node.details.actual || "-")}</p>
              </section>
              {Array.isArray(node.details.evidenceItems) && node.details.evidenceItems.length > 0 && (
                <section>
                  <p className="text-xs font-bold text-ink/40 mb-1">证据列表</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-ink/70 bg-surface/60 rounded-lg p-3 pl-6">
                    {node.details.evidenceItems.map((e, i) => (
                      <li key={i}>{String(e)}</li>
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <p className="text-xs font-bold text-ink/40 mb-1">RAG / Skill / Tool / MCP</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`rounded-lg p-2 ${ragStatus === "empty" ? "bg-warning/10 text-warning" : "bg-emerald-50 text-emerald-800"}`}>
                    RAG: {ragStatus === "empty" ? "空召回 (风险)" : ragStatus === "hit" ? "命中" : ragStatus}
                  </div>
                  <div className="rounded-lg bg-orange-50 text-orange-800 p-2">Skills: {skillCount}</div>
                  <div className="rounded-lg bg-amber-50 text-amber-800 p-2">ToolCall: {toolCallCount}</div>
                  <div className="rounded-lg bg-cyan-50 text-cyan-800 p-2">MCP: {mcpCount}</div>
                </div>
              </section>
              {Boolean(node.details.risk && String(node.details.risk).trim()) && (
                <section>
                  <p className="text-xs font-bold text-ink/40 mb-1">风险提示</p>
                  <p className="text-sm text-warning bg-warning/5 rounded-lg p-3">{String(node.details.risk)}</p>
                </section>
              )}
              {Boolean(node.details.action && String(node.details.action).trim()) && (
                <section>
                  <p className="text-xs font-bold text-ink/40 mb-1">下一步动作</p>
                  <p className="text-sm text-ink/70">{String(node.details.action)}</p>
                </section>
              )}
            </div>
          ) : (
            <>
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
            </>
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

  const n1 = nodes.find((n) => n.nodeKey === "task_description");
  const n2 = nodes.find((n) => n.nodeKey === "sample_data");
  const n3 = nodes.find((n) => n.nodeKey === "annotation_template");
  const n4 = nodes.find((n) => n.nodeKey === "quality_rules");
  const n5 = nodes.find((n) => n.nodeKey === "comprehensive_assessment");
  const n6 = nodes.find((n) => n.nodeKey === "publish_readiness");
  const parallelNodes = [n2, n3, n4].filter(Boolean) as BusinessNode[];

  function NodeCard({ node, stepStr }: { node?: BusinessNode; stepStr: string }) {
    if (!node) return null;
    const c = statusColor(node.status);
    const agent = String(node.details?.agent || NODE_AGENT_LABELS[node.nodeKey] || "");
    const refCount = node.referenceSources.filter((s) => s && s !== "").length;
    const evidenceCount = Array.isArray(node.details?.evidenceItems) ? node.details.evidenceItems.length : 0;
    const risk = riskLevel(node);
    return (
      <button
        type="button"
        onClick={() => setSelectedNode(node)}
        className={`relative w-40 rounded-xl border-2 p-3 text-left transition hover:shadow-md ${
          selectedNode?.id === node.id ? "border-accent ring-2 ring-accent/20" : "border-primary/10"
        } ${c.bg}`}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
          <span className="text-[10px] font-bold text-ink/40">{stepStr}</span>
        </div>
        <p className="text-xs font-bold text-primary leading-tight">{node.title}</p>
        {agent && <p className="text-[9px] font-mono text-ink/40 truncate">{agent}</p>}
        <p className="mt-1 text-[10px] text-ink/50 line-clamp-2">{String(node.details?.actual || node.summary)}</p>
        <div className="mt-2 flex flex-wrap gap-1 text-[9px] text-ink/40">
          <span>{node.durationMs}ms</span>
          {evidenceCount > 0 && <span>· {evidenceCount} 条证据</span>}
          {refCount > 0 && <span>· {refCount} 知识</span>}
          {risk !== "low" && <span className={risk === "high" ? "text-warning" : "text-amber-600"}>· {risk === "high" ? "高风险" : "中风险"}</span>}
        </div>
        <p className={`mt-1 text-[10px] font-bold ${c.text}`}>{node.status === "success" ? "通过" : "需关注"}</p>
      </button>
    );
  }

  const Arrow = () => (
    <div className="flex items-center px-2 text-ink/25 shrink-0" aria-hidden>
      <svg className="h-4 w-8" viewBox="0 0 32 16" fill="none">
        <path d="M0 8h24M24 8l-6-5M24 8l-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-primary">AI 质量审核</h3>
          <p className="text-xs text-ink/50">分支汇聚 DAG：6 个 Agent 并行校验，汇聚综合评估后进入发布准备</p>
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

          {/* Branching DAG — desktop */}
          <div className="hidden lg:flex items-center overflow-x-auto pb-2 min-w-max">
            <div className="flex items-center px-2 gap-0 relative">
              <div className="flex items-center">
                <NodeCard node={n1} stepStr="前置" />
                <Arrow />
              </div>
              <div className="flex flex-col gap-3 py-2 relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-px bg-primary/20" />
                {parallelNodes.map((node, i) => (
                  <NodeCard key={node.id} node={node} stepStr={`并行 ${i + 1}`} />
                ))}
              </div>
              <div className="flex items-center">
                <Arrow />
                <NodeCard node={n5} stepStr="汇聚" />
                <Arrow />
                <NodeCard node={n6} stepStr="终点" />
              </div>
            </div>
          </div>

          {/* Branching DAG — mobile / tablet */}
          <div className="lg:hidden space-y-3">
            {n1 && (
              <div>
                <p className="text-[10px] font-bold text-ink/40 mb-1">前置</p>
                <NodeCard node={n1} stepStr="前置" />
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold text-ink/40 mb-1">并行校验 (样例 / 模板 / 规则)</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {parallelNodes.map((node, i) => (
                  <NodeCard key={node.id} node={node} stepStr={`并行 ${i + 1}`} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-ink/40 mb-1">汇聚 → 发布</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <NodeCard node={n5} stepStr="汇聚" />
                <NodeCard node={n6} stepStr="终点" />
              </div>
            </div>
          </div>

          <p className="text-[10px] text-ink/40 text-center">点击节点查看检查对象、证据、RAG/Skill/Tool 执行与修复建议</p>
        </div>
      )}

      {selectedNode && (
        <NodeDrawer
          node={selectedNode}
          traceId={traceId}
          onClose={() => setSelectedNode(null)}
          onJumpToStep={onJumpToStep}
        />
      )}
    </div>
  );
}
