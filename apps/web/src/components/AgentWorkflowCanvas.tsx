"use client";

import { useState } from "react";
import type { AgentExecutionGroup } from "@/lib/traceExecution";
import { agentLabel, nodeLabel, statusLabelZh } from "@/lib/diagnosticLabels";
import { AgentInternalGraph, extractInternalGraph } from "./AgentInternalGraph";
import { CallReportPanel } from "./CallReportPanel";
import { KeyValueViewer } from "./KeyValueViewer";
import { PagedRawJson } from "./TraceSpanTimeline";

type DevTab = "workflow" | "graph" | "tech";

interface Props {
  group: AgentExecutionGroup;
  traceId: string;
  onClose?: () => void;
  variant?: "inline" | "drawer";
}

function statusBadge(status: string) {
  if (status === "success") return "bg-success/10 text-success border-success/20";
  if (status === "warning") return "bg-warning/10 text-warning border-warning/20";
  return "bg-danger/10 text-danger border-danger/20";
}

function agentOutputSummary(raw?: { outputPreview?: Record<string, unknown> }) {
  const out = (raw?.outputPreview || {}) as Record<string, unknown>;
  return {
    conclusion: out.conclusion ?? out.summary,
    status: out.status,
    nodeKey: out.nodeKey,
    sequence: out.sequence,
  };
}


export function AgentWorkflowCanvas({ group, traceId, onClose, variant = "inline" }: Props) {
  const [tab, setTab] = useState<DevTab>("workflow");
  const raw = group.raw as { inputPreview?: Record<string, unknown>; outputPreview?: Record<string, unknown> } | undefined;
  const extracted = extractInternalGraph(raw);
  const mapping = extracted.businessMapping;
  const upstream = (mapping?.upstream as string[]) || [];
  const downstream = (mapping?.downstream as string[]) || [];
  const outSummary = agentOutputSummary(raw);
  const inSummary = (raw?.inputPreview || {}) as Record<string, unknown>;

  const body = (
    <div className={`space-y-5 ${variant === "drawer" ? "p-5" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-ink/40">Agent 排障抽屉</p>
          <h4 className="text-lg font-bold text-primary">{agentLabel(group.agent)}</h4>
          <p className="text-xs text-ink/50 mt-1">
            负责 {nodeLabel(group.nodeKey)} · 第 {group.sequence} 步 · {group.durationMs}ms
            <span className={`ml-2 rounded border px-1.5 py-0.5 text-[10px] font-bold ${statusBadge(group.status)}`}>
              {statusLabelZh(group.status)}
            </span>
          </p>
          <p className="text-[10px] text-ink/40 mt-1 font-mono" title={group.agent}>
            技术 ID：{group.agent}
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-ink/50 hover:bg-surface shrink-0">
            关闭
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-ink/60">
        <span>上游：{upstream.length ? upstream.map(nodeLabel).join("、") : "无"}</span>
        <span>下游：{downstream.length ? downstream.map(nodeLabel).join("、") : "无"}</span>
        <span className="font-mono text-ink/40">trace {traceId.slice(0, 16)}…</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {([
          ["workflow", "执行流"],
          ["graph", "执行子图"],
          ["tech", "技术详情"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === key ? "bg-accent text-white" : "bg-white text-ink/50 border border-primary/10"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "workflow" && (
        <div className="space-y-5">
          {extracted.promptPreview && (
            <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4" data-testid="prompt-input-section">
              <p className="text-[10px] font-bold text-indigo-400 mb-2">Prompt 输入</p>
              <KeyValueViewer data={extracted.promptPreview as Record<string, unknown>} />
            </section>
          )}

          {extracted.decisionSteps.length > 0 && (
            <section className="rounded-xl border border-amber-100 bg-amber-50/30 p-4">
              <p className="text-[10px] font-bold text-amber-600 mb-2">决策轮次摘要</p>
              <div className="space-y-2">
                {extracted.decisionSteps.slice(0, 3).map((step, i) => (
                  <div key={String(step.id || i)} className="rounded-lg bg-white/80 px-3 py-2 text-xs">
                    <p className="font-bold text-primary">{String(step.title || "决策")}</p>
                    {step.result != null && <p className="text-ink/70 mt-0.5">{String(step.result)}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <CallReportPanel calls={group.calls as Record<string, unknown>} title="调用证据（输入 → 执行 → 输出）" paginate />

          {inSummary && Object.keys(inSummary).length > 0 && (
            <section className="rounded-xl border border-primary/10 bg-surface/30 p-4">
              <p className="text-[10px] font-bold text-ink/40 mb-2">本节点输入</p>
              <KeyValueViewer data={inSummary} />
            </section>
          )}

          <section className="rounded-xl border border-primary/10 bg-surface/30 p-4" data-testid="agent-output-section">
            <p className="text-[10px] font-bold text-ink/40 mb-2">Agent 输出</p>
            <KeyValueViewer data={outSummary as Record<string, unknown>} />
          </section>
        </div>
      )}

      {tab === "graph" && (
        <AgentInternalGraph
          internalGraph={extracted.internalGraph}
          decisionSteps={extracted.decisionSteps}
          compact
        />
      )}

      {tab === "tech" && (
        <div className="space-y-3">
          <PagedRawJson data={group.raw || group.calls} />
        </div>
      )}
    </div>
  );

  if (variant === "drawer") {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} aria-hidden data-testid="agent-trace-drawer-overlay" />
        <aside
          className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[960px] overflow-y-auto border-l border-accent/20 bg-white shadow-2xl"
          data-testid="agent-trace-drawer"
        >
          {body}
        </aside>
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-white to-surface/40 p-5 shadow-sm">
      {body}
    </div>
  );
}
