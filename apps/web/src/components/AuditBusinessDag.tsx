"use client";

import { useMemo, useState } from "react";
import { DagCanvas, useNarrowScreen } from "./DagCanvas";
import { Pagination, paginateSlice } from "./Pagination";
import {
  BUSINESS_DAG_EDGES,
  BUSINESS_DAG_LANE_LABELS,
  computeBusinessDagLayout,
  computeVerticalDagLayout,
  DEFAULT_NODE_H,
  DEFAULT_NODE_W,
  LANE_GUTTER_W,
} from "@/lib/dagLayout";
import { businessVerdict, upstreamDownstream, verdictTone, type BusinessVerdict } from "@/lib/businessDagStatus";
import { nodeLabel } from "@/lib/diagnosticLabels";

const EVIDENCE_PER_PAGE = 5;
const IMPACT_PER_PAGE = 5;

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

function EvidenceItemCard({ row }: { row: Record<string, unknown> }) {
  const type = String(row.type || "");
  if (type === "component") {
    const required = String(row.requirement || "");
    return (
      <li className="flex flex-wrap items-center gap-2 rounded-lg bg-white/80 px-3 py-2">
        <span className="font-bold text-primary">{String(row.label)}</span>
        <span className="text-[10px] rounded border border-primary/15 bg-surface/40 px-1.5 py-0.5 text-ink/60">
          {String(row.role || "组件")}
        </span>
        <span
          className={`text-[10px] rounded border px-1.5 py-0.5 ${
            required === "必填" ? "border-accent/30 bg-accent/10 text-accent" : "border-primary/15 text-ink/40"
          }`}
        >
          {required || "可选"}
        </span>
        {Number(row.validationCount) > 0 && (
          <span className="text-[10px] text-ink/40">校验 {String(row.validationCount)} 条</span>
        )}
      </li>
    );
  }
  if (type === "severity") {
    return (
      <li className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2">
        <span className="text-sm text-ink/70">严重级别 · {String(row.label)}</span>
        <span className="font-bold text-primary">{String(row.value)} 条</span>
      </li>
    );
  }
  if (type === "distribution" || type === "auto_pass") {
    return (
      <li className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2">
        <span className="text-sm text-ink/70">{String(row.label)}</span>
        <span className="font-bold text-primary">{String(row.value)}</span>
      </li>
    );
  }
  return (
    <li className="rounded-lg bg-white/80 px-3 py-2 text-sm text-ink/70">
      <span className="font-bold text-primary">{String(row.label ?? row.type ?? "依据")}</span>
    </li>
  );
}

function BusinessInputCard({ nodeKey, details }: { nodeKey: string; details: Record<string, unknown> }) {
  const actual = (details.actual || {}) as Record<string, unknown>;
  const chips: Array<{ label: string; value: string }> = [];
  if (nodeKey === "sample_data" && actual.sampleCount != null) {
    chips.push({ label: "样例条数", value: `${actual.sampleCount} 条` });
  }
  if (Array.isArray(actual.fields) && actual.fields.length) {
    chips.push({ label: "字段", value: actual.fields.slice(0, 4).join("、") });
  }
  if (nodeKey === "annotation_template" && actual.componentCount != null) {
    chips.push({ label: "组件数", value: `${actual.componentCount} 个` });
  }
  if (nodeKey === "quality_rules" && actual.ruleCount != null) {
    chips.push({ label: "规则条数", value: `${actual.ruleCount} 条` });
  }
  if (Array.isArray(actual.dimensions) && actual.dimensions.length) {
    chips.push({ label: "评分维度", value: actual.dimensions.join("、") });
  }
  if (chips.length === 0 && Array.isArray(details.checkedItems)) {
    for (const it of (details.checkedItems as Array<Record<string, unknown>>).slice(0, 3)) {
      chips.push({ label: String(it.label || ""), value: String(it.value || "") });
    }
  }
  return (
    <section className="rounded-xl border border-primary/10 bg-surface/30 p-4">
      <p className="text-[10px] font-bold text-ink/40 mb-2">业务输入</p>
      {chips.length === 0 ? (
        <p className="text-sm text-ink/50">本节点无显式输入指标</p>
      ) : (
        <ul className="space-y-1.5">
          {chips.map((c, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-1.5">
              <span className="text-xs text-ink/40">{c.label}</span>
              <span className="text-sm font-bold text-primary">{c.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const DAG_ORDER = [
  "task_description",
  "sample_data",
  "annotation_template",
  "quality_rules",
  "comprehensive_assessment",
  "publish_readiness",
];

function BusinessConclusionDrawer({
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
  const [evidencePage, setEvidencePage] = useState(1);
  const [impactPage, setImpactPage] = useState(1);
  const userSummary = (node.details?.userSummary || {}) as Record<string, unknown>;
  const verdict = (String(userSummary.verdict || businessVerdict(node))) as BusinessVerdict;
  const tone = verdictTone(verdict);
  const evidenceItems = (node.details?.evidenceItems as unknown[]) || [];
  const { upstream, downstream } = upstreamDownstream(node.nodeKey);
  const evidencePaged = paginateSlice(evidenceItems, evidencePage, EVIDENCE_PER_PAGE);

  const impactLines = [
    String(userSummary.businessImpact || node.impact || "").trim(),
    ...(node.referenceSources?.length ? [`参考来源：${node.referenceSources.join("、")}`] : []),
  ].filter(Boolean);
  const impactPaged = paginateSlice(impactLines, impactPage, IMPACT_PER_PAGE);

  const nextStep = String(userSummary.nextStep || node.suggestion || (node.status === "success" ? "继续发布流程" : "返回对应步骤修复"));
  const confidenceReason = String(userSummary.confidenceReason || "");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} aria-hidden data-testid="business-drawer-overlay" />
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-3xl overflow-y-auto border-l border-accent/20 bg-white shadow-2xl"
        data-testid="business-conclusion-drawer"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/10 bg-white px-5 py-4 gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-ink/40">业务结论 · {nodeLabel(node.nodeKey)}</p>
            <h4 className="text-lg font-bold text-primary">{node.title}</h4>
            <p className="text-[10px] text-ink/40 mt-1">
              {node.durationMs}ms · 上游 {upstream.map(nodeLabel).join("、") || "无"} → 下游 {downstream.map(nodeLabel).join("、") || "无"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {traceId && (
              <a
                href={`/?view=trace&traceId=${encodeURIComponent(traceId)}`}
                className="rounded-lg border border-primary/15 bg-surface/30 px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface/50"
              >
                开发者 Trace →
              </a>
            )}
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink/50 hover:bg-surface">关闭</button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <BusinessInputCard nodeKey={node.nodeKey} details={(node.details || {}) as Record<string, unknown>} />

            <section className={`rounded-xl border p-4 ${tone.bg} ${tone.border}`}>
              <p className="text-[10px] font-bold text-ink/40 mb-2">审核结论</p>
              <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold mb-2 ${tone.text} ${tone.border}`}>{verdict}</span>
              <p className="text-sm font-bold text-primary">{String(userSummary.conclusion || node.summary)}</p>
              {confidenceReason && <p className="text-xs text-warning mt-2">{confidenceReason}</p>}
            </section>
          </div>

          <section className="rounded-xl border border-primary/10 bg-surface/30 p-4">
            <p className="text-[10px] font-bold text-ink/40 mb-2">依据摘要</p>
            <p className="text-sm text-ink/80">{String(userSummary.evidenceSummary || node.evidence)}</p>
            {evidenceItems.length > 0 && (
              <>
                <ul className="mt-3 space-y-1 text-xs text-ink/70">
                  {evidencePaged.items.map((item, i) => (
                    <EvidenceItemCard key={i} row={item as Record<string, unknown>} />
                  ))}
                </ul>
                <Pagination className="mt-2" page={evidencePaged.page} totalPages={evidencePaged.totalPages} onPageChange={setEvidencePage} label="依据条目" />
              </>
            )}
          </section>

          <section className="rounded-xl border border-primary/10 bg-surface/30 p-4">
            <p className="text-[10px] font-bold text-ink/40 mb-2">影响范围</p>
            {impactLines.length === 0 ? (
              <p className="text-sm text-ink/50">无额外影响</p>
            ) : (
              <>
                <ul className="space-y-1 text-sm text-ink/80">
                  {impactPaged.items.map((line, i) => (
                    <li key={i} className="rounded-lg bg-white/80 px-2 py-1.5">{line}</li>
                  ))}
                </ul>
                {impactPaged.totalPages > 1 && (
                  <Pagination className="mt-2" page={impactPaged.page} totalPages={impactPaged.totalPages} onPageChange={setImpactPage} label="影响条目" />
                )}
              </>
            )}
          </section>

          <section className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <p className="text-[10px] font-bold text-ink/40 mb-2">下一步</p>
            <p className="text-sm font-bold text-primary">{nextStep}</p>
            {node.status !== "success" && node.fixStep && onJumpToStep && (
              <button
                onClick={() => onJumpToStep(node.fixStep)}
                className="mt-3 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent/90"
              >
                前往修复：{FIX_STEP_LABELS[node.fixStep] || node.fixStep} →
              </button>
            )}
          </section>
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
    const userSummary = (node.details?.userSummary || {}) as Record<string, unknown>;
    const verdict = (String(userSummary.verdict || businessVerdict(node))) as BusinessVerdict;
    const tone = verdictTone(verdict);
    const dimmed = selectedNode && !highlightKeys.has(nodeKey);
    const nw = layoutItem.width ?? DEFAULT_NODE_W;

    return (
      <button
        type="button"
        onClick={() => setSelectedNode(node)}
        className={`absolute rounded-2xl border-2 p-4 text-left transition-all hover:shadow-lg ${
          selectedNode?.id === node.id ? "border-accent ring-2 ring-accent/25 scale-[1.02]" : "border-primary/10"
        } ${tone.bg} ${dimmed ? "opacity-40" : ""}`}
        style={{ left: layoutItem.x, top: layoutItem.y, width: nw, minHeight: DEFAULT_NODE_H }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-[10px] font-bold text-ink/40">{nodeLabel(nodeKey)}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${tone.text} ${tone.border}`}>{verdict}</span>
        </div>
        <p className="text-sm font-bold text-primary leading-snug">{node.title}</p>
        <p className="text-xs text-ink/70 mt-2 line-clamp-2">{node.summary}</p>
        <p className="text-[10px] text-ink/40 mt-2">{node.durationMs}ms</p>
      </button>
    );
  }

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-primary">AI 质量审核</h3>
          <p className="text-xs text-ink/50">使用者视角 — 点击节点打开业务结论抽屉</p>
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
              查看开发者 Trace
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
            <p className="text-xs text-ink/40 text-center">点击任意节点打开右侧业务结论抽屉</p>
          )}

          <div className="w-full overflow-x-auto pb-2">
            <DagCanvas width={width} height={height} nodes={layout} edges={edges} nodeWidth={DEFAULT_NODE_W} nodeHeight={DEFAULT_NODE_H} laneLabels={narrow ? undefined : BUSINESS_DAG_LANE_LABELS} laneGutter={narrow ? 0 : LANE_GUTTER_W} highlightNodeIds={highlightKeys.size ? [...highlightKeys] : undefined} markerPrefix="biz">
              {layout.map((l) => (
                <NodeCard key={l.id} nodeKey={l.id} layoutItem={l} />
              ))}
            </DagCanvas>
          </div>
        </div>
      )}

      {selectedNode && (
        <BusinessConclusionDrawer
          node={selectedNode}
          traceId={traceId}
          onClose={() => setSelectedNode(null)}
          onJumpToStep={onJumpToStep}
        />
      )}
    </div>
  );
}
