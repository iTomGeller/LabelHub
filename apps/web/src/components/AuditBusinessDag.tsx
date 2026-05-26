"use client";

import { useMemo, useState } from "react";
import { CallReportPanel } from "./CallReportPanel";
import { DagCanvas, useNarrowScreen } from "./DagCanvas";
import {
  BUSINESS_DAG_EDGES,
  BUSINESS_DAG_LANE_LABELS,
  computeBusinessDagLayout,
  computeVerticalDagLayout,
  DEFAULT_NODE_H,
  DEFAULT_NODE_W,
} from "@/lib/dagLayout";
import { businessVerdict, upstreamDownstream, verdictTone } from "@/lib/businessDagStatus";
import { agentLabel } from "@/lib/diagnosticLabels";

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
  hashMismatch?: boolean;
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

const STEP_LABELS: Record<string, string> = {
  task_description: "任务说明",
  sample_data: "样例数据",
  annotation_template: "标注模板",
  quality_rules: "质检规则",
  comprehensive_assessment: "综合评估",
  publish_readiness: "发布准备",
};

const DAG_ORDER = [
  "task_description",
  "sample_data",
  "annotation_template",
  "quality_rules",
  "comprehensive_assessment",
  "publish_readiness",
];

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
  const verdict = businessVerdict(node);
  const tone = verdictTone(verdict);
  const action = node.details?.action as Record<string, unknown> | undefined;
  const calls = node.details?.calls as Record<string, unknown> | undefined;
  const evidenceItems = node.details?.evidenceItems as unknown[] | undefined;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-14 bottom-0 z-50 w-full max-w-lg overflow-y-auto border-l border-primary/10 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-primary/10 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold text-ink/40">审核报告 · {STEP_LABELS[node.nodeKey] || node.title}</p>
            <h4 className="text-lg font-bold text-primary">{node.title}</h4>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink/50 hover:bg-surface">关闭</button>
        </div>
        <div className="space-y-5 p-5">
          <section className={`rounded-xl border p-4 ${tone.bg} ${tone.border}`}>
            <p className="text-[10px] font-bold text-ink/40 mb-1">结论</p>
            <div className="flex items-center gap-2 mb-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${tone.text} ${tone.border}`}>{verdict}</span>
              <span className="text-[10px] text-ink/40">{node.durationMs}ms</span>
            </div>
            <p className="text-sm font-bold text-primary">{node.summary}</p>
          </section>

          <section className="rounded-xl border border-primary/10 bg-surface/30 p-4">
            <p className="text-[10px] font-bold text-ink/40 mb-2">依据</p>
            <p className="text-sm text-ink/80 mb-2">{node.evidence}</p>
            {Array.isArray(evidenceItems) && evidenceItems.length > 0 && (
              <ul className="space-y-1 text-xs text-ink/70">
                {evidenceItems.slice(0, 5).map((item, i) => {
                  const row = item as Record<string, unknown>;
                  return (
                    <li key={i} className="rounded-lg bg-white/80 px-2 py-1.5">
                      <span className="font-bold text-primary">{String(row.label ?? row.type)}</span>
                      {row.value != null && <span> — {String(row.value)}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-primary/10 bg-surface/30 p-4">
            <p className="text-[10px] font-bold text-ink/40 mb-2">下一步</p>
            <p className="text-sm text-ink/80">
              {String(action?.label || (node.status === "success" ? "继续发布流程" : "返回修复"))}
              {node.suggestion ? `：${node.suggestion}` : action?.reason ? `：${String(action.reason)}` : ""}
            </p>
            {node.impact && <p className="mt-2 text-xs text-warning">{node.impact}</p>}
          </section>

          <CallReportPanel calls={calls} title="调用摘要（默认业务视图）" />

          {traceId && (
            <details className="text-xs text-ink/40">
              <summary className="cursor-pointer font-bold">技术标识</summary>
              <p className="font-mono break-all mt-1">{traceId}</p>
              <p className="font-mono break-all mt-1">{String(node.details?.agent || node.nodeKey)}</p>
            </details>
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
  hashMismatch,
  traceId,
  onForceRerun,
  onJumpToStep,
}: Props) {
  const [selectedNode, setSelectedNode] = useState<BusinessNode | null>(null);
  const narrow = useNarrowScreen();

  const passedCount = nodes.filter((n) => n.status === "success").length;
  const allPassed = nodes.length > 0 && passedCount === nodes.length;
  const totalMs = nodes.reduce((s, n) => s + n.durationMs, 0);
  const ragEmptyCount = nodes.filter((n) => n.details?.ragStatus === "empty").length;
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.nodeKey, n]));

  const highlightKeys = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const { upstream, downstream } = upstreamDownstream(selectedNode.nodeKey);
    return new Set([selectedNode.nodeKey, ...upstream, ...downstream]);
  }, [selectedNode]);

  const { layout, width, height } = useMemo(() => {
    if (narrow) return computeVerticalDagLayout(DAG_ORDER, DEFAULT_NODE_W, DEFAULT_NODE_H);
    return computeBusinessDagLayout(DEFAULT_NODE_W, DEFAULT_NODE_H);
  }, [narrow]);

  const edges = narrow
    ? DAG_ORDER.slice(0, -1).map((id, i) => ({ from: id, to: DAG_ORDER[i + 1] }))
    : BUSINESS_DAG_EDGES;

  function NodeCard({ nodeKey, layoutItem }: { nodeKey: string; layoutItem: { x: number; y: number; width?: number; height?: number } }) {
    const node = nodeMap[nodeKey];
    if (!node) return null;
    const verdict = businessVerdict(node);
    const tone = verdictTone(verdict);
    const highlighted = !selectedNode || highlightKeys.has(nodeKey);
    const dimmed = selectedNode && !highlightKeys.has(nodeKey);
    const nw = layoutItem.width ?? DEFAULT_NODE_W;

    return (
      <button
        type="button"
        onClick={() => setSelectedNode(node)}
        className={`absolute rounded-2xl border-2 p-4 text-left transition-all hover:shadow-lg ${
          selectedNode?.id === node.id ? "border-accent ring-2 ring-accent/25 scale-[1.02]" : "border-primary/10"
        } ${tone.bg} ${dimmed ? "opacity-40" : ""} ${!highlighted ? "" : ""}`}
        style={{ left: layoutItem.x, top: layoutItem.y, width: nw, minHeight: DEFAULT_NODE_H }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-[10px] font-bold text-ink/40">{STEP_LABELS[nodeKey]}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${tone.text} ${tone.border}`}>{verdict}</span>
        </div>
        <p className="text-sm font-bold text-primary leading-snug">{node.title}</p>
        <p className="text-xs text-ink/70 mt-2 line-clamp-2">{node.summary}</p>
        <p className="text-[10px] text-ink/40 mt-2">{node.durationMs}ms · {agentLabel(String(node.details?.agent || nodeKey))}</p>
      </button>
    );
  }

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-primary">AI 质量审核</h3>
          <p className="text-xs text-ink/50">产品化流程图 — 点击节点查看结论、依据与下一步</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hashMismatch && (
            <span className="text-[10px] text-warning bg-warning/5 border border-warning/20 rounded px-2 py-0.5">展示最近一次审核（配置已变更）</span>
          )}
          {fromCache && isCacheValid !== false && !hashMismatch && (
            <span className="text-[10px] text-success/70 bg-success/5 border border-success/10 rounded px-2 py-0.5">已使用上次审核结果</span>
          )}
          {traceId && (
            <a href={`/?view=trace&traceId=${encodeURIComponent(traceId)}`} className="rounded-xl border border-primary/15 px-3 py-2 text-xs font-bold text-primary hover:bg-surface/50">
              打开 Trace 排障台
            </a>
          )}
          <button onClick={onForceRerun} disabled={loading} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${loading ? "bg-accent/50 text-white cursor-wait" : "border border-accent/30 text-accent hover:bg-accent/5"}`}>
            {loading ? "审核中…" : "重新生成审核报告"}
          </button>
        </div>
      </div>

      {ragEmptyCount > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning">
          {ragEmptyCount} 个节点知识库空召回（独立状态，不等同于失败）。当前结论偏静态规则，建议补充知识库后重审。
        </div>
      )}

      {loading && (
        <div className="py-8 flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          <p className="text-sm text-ink/50">正在生成业务审查报告…</p>
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
              <p className="text-xs text-ink/40">耗时 {(totalMs / 1000).toFixed(1)} 秒 · 点击节点高亮上下游链路</p>
            </div>
          </div>

          {!selectedNode && (
            <p className="text-xs text-ink/40 text-center">点击任意节点查看为什么通过 / 为什么低置信</p>
          )}

          <div className="w-full overflow-x-auto pb-2">
            <DagCanvas width={width} height={height} nodes={layout} edges={edges} nodeWidth={DEFAULT_NODE_W} nodeHeight={DEFAULT_NODE_H} laneLabels={narrow ? undefined : BUSINESS_DAG_LANE_LABELS} highlightNodeIds={highlightKeys.size ? [...highlightKeys] : undefined}>
              {layout.map((l) => (
                <NodeCard key={l.id} nodeKey={l.id} layoutItem={l} />
              ))}
            </DagCanvas>
          </div>
        </div>
      )}

      {selectedNode && (
        <NodeDrawer node={selectedNode} traceId={traceId} onClose={() => setSelectedNode(null)} onJumpToStep={onJumpToStep} />
      )}
    </div>
  );
}
