"use client";

import { useState } from "react";
import { CallReportPanel, CallSummaryChips } from "./CallReportPanel";
import { DagCanvas, BUSINESS_DAG_LAYOUT, BUSINESS_DAG_EDGES } from "./DagCanvas";
import { countCalls } from "@/lib/callReport";

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

const STEP_LABELS: Record<string, string> = {
  task_description: "前置",
  sample_data: "并行 1",
  annotation_template: "并行 2",
  quality_rules: "并行 3",
  comprehensive_assessment: "汇聚",
  publish_readiness: "终点",
};

function statusColor(status: string) {
  return status === "success"
    ? { ring: "ring-success/30", bg: "bg-success/10", text: "text-success", dot: "bg-success" }
    : { ring: "ring-warning/40", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" };
}

function riskLevel(node: BusinessNode): "low" | "medium" | "high" {
  const risk = node.details?.risk as Record<string, unknown> | undefined;
  if (risk?.level === "high" || node.status !== "success") return "high";
  if (risk?.level === "medium" || node.details?.ragStatus === "empty") return "medium";
  return "low";
}

function renderStructuredList(items: unknown, fallback?: string) {
  if (Array.isArray(items) && items.length > 0) {
    return (
      <ul className="space-y-1 text-sm text-ink/80">
        {items.map((item, i) => {
          if (item && typeof item === "object") {
            const row = item as Record<string, unknown>;
            const label = String(row.label ?? row.type ?? `#${i + 1}`);
            const value = row.value ?? row.expected ?? "";
            const status = row.status ? ` · ${String(row.status)}` : "";
            return (
              <li key={i} className="rounded-lg bg-surface/60 px-3 py-2">
                <span className="font-bold text-primary">{label}</span>
                {value !== "" && <span className="text-ink/70"> — {String(value)}{status}</span>}
              </li>
            );
          }
          return <li key={i} className="rounded-lg bg-surface/60 px-3 py-2">{String(item)}</li>;
        })}
      </ul>
    );
  }
  if (fallback) return <p className="text-sm text-ink/80">{fallback}</p>;
  return <p className="text-sm text-ink/40">-</p>;
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
  const calls = node.details?.calls as Record<string, unknown> | undefined;
  const risk = node.details?.risk as Record<string, unknown> | undefined;
  const action = node.details?.action as Record<string, unknown> | undefined;
  const detailsTraceId = String(node.details?.traceId || "");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-14 bottom-0 z-50 w-full max-w-md overflow-y-auto border-l border-primary/10 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-primary/10 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold text-ink/40">审核报告</p>
            <h4 className="text-lg font-bold text-primary">{node.title}</h4>
            <p className="text-[10px] font-mono text-ink/40 mt-0.5">{agent} · {node.nodeKey}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink/50 hover:bg-surface">关闭</button>
        </div>
        <div className="space-y-5 p-5">
          {traceId && detailsTraceId && detailsTraceId !== traceId && (
            <div className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
              详情 traceId 与当前 run 不一致，已拒绝使用旧缓存数据
            </div>
          )}

          <div className={`rounded-xl p-4 ring-2 ${colors.ring} ${colors.bg}`}>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
              <span className={`text-sm font-bold ${colors.text}`}>{node.status === "success" ? "通过" : "需关注"}</span>
              <span className="ml-auto text-xs text-ink/40 font-mono">{node.durationMs}ms</span>
            </div>
            <p className="mt-2 text-sm text-primary">{node.summary}</p>
          </div>

          {traceId && (
            <div className="rounded-lg bg-surface/50 p-2 text-xs">
              <span className="text-ink/40">Trace ID</span>
              <p className="font-mono text-primary break-all text-[10px]">{traceId}</p>
            </div>
          )}

          <CallReportPanel calls={calls} />

          <section>
            <p className="text-xs font-bold text-ink/40 mb-2">检查对象</p>
            {renderStructuredList(node.details?.checkedItems, String(node.details?.checkedItems || node.summary))}
          </section>
          <section>
            <p className="text-xs font-bold text-ink/40 mb-2">判定规则</p>
            {renderStructuredList(node.details?.criteria, String(node.details?.criteria || "-"))}
          </section>
          <section>
            <p className="text-xs font-bold text-ink/40 mb-2">实际数据</p>
            {renderStructuredList(node.details?.actual, String(node.details?.actual || "-"))}
          </section>
          <section>
            <p className="text-xs font-bold text-ink/40 mb-2">证据列表</p>
            {renderStructuredList(node.details?.evidenceItems, node.evidence || "无结构化证据")}
          </section>

          {(risk?.reason || node.impact) && (
            <section>
              <p className="text-xs font-bold text-ink/40 mb-1">风险提示</p>
              <p className="text-sm text-warning bg-warning/5 rounded-lg p-3">{String(risk?.reason || node.impact)}</p>
            </section>
          )}

          {(action?.reason || action?.label || node.suggestion) && (
            <section>
              <p className="text-xs font-bold text-ink/40 mb-1">下一步动作</p>
              <p className="text-sm text-ink/70">{String(action?.label || "修复")} — {String(action?.reason || node.suggestion)}</p>
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
  const ragEmptyCount = nodes.filter((n) => n.details?.ragStatus === "empty").length;
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.nodeKey, n]));

  function NodeCard({ nodeKey }: { nodeKey: string }) {
    const node = nodeMap[nodeKey];
    if (!node) return null;
    const layout = BUSINESS_DAG_LAYOUT.find((l) => l.id === nodeKey);
    if (!layout) return null;

    const c = statusColor(node.status);
    const agent = String(node.details?.agent || NODE_AGENT_LABELS[node.nodeKey] || "");
    const evidenceCount = Array.isArray(node.details?.evidenceItems) ? node.details.evidenceItems.length : 0;
    const calls = node.details?.calls as Record<string, unknown> | undefined;
    const callCount = countCalls(calls).total;
    const actualMetric = Array.isArray(node.details?.actual)
      ? (node.details.actual as Record<string, unknown>[]).map((a) => String(a.value ?? a.label)).join(" · ")
      : String(node.details?.actual || node.summary);
    const risk = riskLevel(node);

    return (
      <button
        type="button"
        onClick={() => setSelectedNode(node)}
        className={`absolute w-[180px] rounded-xl border-2 p-3 text-left transition hover:shadow-md ${
          selectedNode?.id === node.id ? "border-accent ring-2 ring-accent/20" : "border-primary/10"
        } ${c.bg}`}
        style={{ left: layout.x, top: layout.y }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
          <span className="text-[10px] font-bold text-ink/40">{STEP_LABELS[nodeKey]}</span>
        </div>
        <p className="text-xs font-bold text-primary leading-tight">{node.title}</p>
        {agent && <p className="text-[9px] font-mono text-ink/40 truncate">{agent}</p>}
        <p className="mt-1 text-[10px] text-ink/50 line-clamp-2">{actualMetric}</p>
        <div className="mt-2 flex flex-wrap gap-1 text-[9px] text-ink/40">
          <span>{node.durationMs}ms</span>
          {evidenceCount > 0 && <span>· {evidenceCount} 证据</span>}
          {callCount > 0 && <span>· {callCount} 调用</span>}
          {risk !== "low" && <span className={risk === "high" ? "text-warning" : "text-amber-600"}>· {risk === "high" ? "高风险" : "中风险"}</span>}
        </div>
        <div className="mt-2">
          <CallSummaryChips calls={calls} />
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-primary">AI 质量审核</h3>
          <p className="text-xs text-ink/50">分支汇聚 DAG — 点击节点查看结构化审核报告与 Tool/Skill 执行明细</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fromCache && isCacheValid !== false && (
            <span className="text-[10px] text-success/70 bg-success/5 border border-success/10 rounded px-2 py-0.5">已使用上次审核结果</span>
          )}
          {fromCache && isCacheValid === false && (
            <span className="text-[10px] text-warning bg-warning/5 border border-warning/20 rounded px-2 py-0.5">旧缓存已丢弃</span>
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

      {ragEmptyCount > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning">
          知识库未命中：{ragEmptyCount} 个节点 RAG 空召回，当前审核基于静态规则，置信度低
        </div>
      )}

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

          <div className="overflow-x-auto pb-2">
            <DagCanvas width={800} height={440} nodes={BUSINESS_DAG_LAYOUT} edges={BUSINESS_DAG_EDGES}>
              {BUSINESS_DAG_LAYOUT.map((layout) => (
                <NodeCard key={layout.id} nodeKey={layout.id} />
              ))}
            </DagCanvas>
          </div>

          <p className="text-[10px] text-ink/40 text-center">点击节点查看对象清单、规则、实际数据、证据与 Tool/Skill/Sandbox/MCP 执行结果</p>
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
