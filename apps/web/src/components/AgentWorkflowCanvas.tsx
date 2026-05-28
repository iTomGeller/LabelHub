"use client";

import { useState } from "react";
import type { AgentExecutionGroup } from "@/lib/traceExecution";
import { agentLabel, nodeLabel, statusLabelZh } from "@/lib/diagnosticLabels";
import { AgentInternalGraph, extractInternalGraph } from "./AgentInternalGraph";
import { CallReportPanel } from "./CallReportPanel";
import { KeyValueViewer } from "./KeyValueViewer";
import { PagedRawJson } from "./TraceSpanTimeline";

type DevTab = "canvas" | "calls" | "tech";

interface Props {
  group: AgentExecutionGroup;
  traceId: string;
  onClose?: () => void;
}

function statusBadge(status: string) {
  if (status === "success") return "bg-success/10 text-success border-success/20";
  if (status === "warning") return "bg-warning/10 text-warning border-warning/20";
  return "bg-danger/10 text-danger border-danger/20";
}

export function AgentWorkflowCanvas({ group, traceId, onClose }: Props) {
  const [tab, setTab] = useState<DevTab>("canvas");
  const raw = group.raw as { inputPreview?: Record<string, unknown>; outputPreview?: Record<string, unknown> } | undefined;
  const extracted = extractInternalGraph(raw);
  const mapping = extracted.businessMapping;
  const upstream = (mapping?.upstream as string[]) || [];
  const downstream = (mapping?.downstream as string[]) || [];

  return (
    <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-white to-surface/40 p-5 space-y-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-ink/40">Agent 执行画布</p>
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
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-ink/50 hover:bg-surface">
            收起画布
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
          ["canvas", "执行子图"],
          ["calls", "调用证据"],
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

      {tab === "canvas" && (
        <div className="space-y-5">
          {extracted.promptPreview && (
            <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <p className="text-[10px] font-bold text-indigo-400 mb-2">Prompt 输入</p>
              <KeyValueViewer data={extracted.promptPreview as Record<string, unknown>} />
            </section>
          )}
          <AgentInternalGraph
            internalGraph={extracted.internalGraph}
            decisionSteps={extracted.decisionSteps}
          />
          {raw?.inputPreview && (
            <section className="rounded-xl border border-primary/10 bg-surface/30 p-4">
              <p className="text-[10px] font-bold text-ink/40 mb-2">本节点输入</p>
              <KeyValueViewer data={raw.inputPreview as Record<string, unknown>} />
            </section>
          )}
          {raw?.outputPreview && (
            <section className="rounded-xl border border-primary/10 bg-surface/30 p-4">
              <p className="text-[10px] font-bold text-ink/40 mb-2">Agent 输出</p>
              <KeyValueViewer data={(raw.outputPreview as Record<string, unknown>)} />
            </section>
          )}
        </div>
      )}

      {tab === "calls" && (
        <CallReportPanel calls={group.calls as Record<string, unknown>} title="调用证据（输入 → 执行 → 输出）" paginate />
      )}

      {tab === "tech" && (
        <div className="space-y-3">
          <PagedRawJson data={group.raw || group.calls} />
        </div>
      )}
    </div>
  );
}
