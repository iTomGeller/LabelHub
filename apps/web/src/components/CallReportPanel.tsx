"use client";

import { callKindLabel, callStatusTone, flattenCalls, type CallRecord } from "@/lib/callReport";
import { useState } from "react";

function BusinessCallCard({ row }: { row: CallRecord }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-surface/40 p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-primary">{callKindLabel(row.kind)}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${callStatusTone(row.status)}`}>{row.statusZh}</span>
      </div>
      <p className="text-sm text-ink/80">{row.conclusion || row.nameZh}</p>
      {row.durationMs != null && row.durationMs > 0 && (
        <p className="text-[10px] text-ink/40">耗时 {row.durationMs}ms</p>
      )}
    </div>
  );
}

function groupRows(rows: CallRecord[]) {
  const knowledge = rows.filter((r) => r.kind === "rag");
  const checks = rows.filter((r) => r.kind === "skill" || r.kind === "tool" || r.kind === "sandbox");
  const external = rows.filter((r) => r.kind === "mcp");
  return { knowledge, checks, external };
}

function CallTable({ rows }: { rows: CallRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-primary/10">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface/60 text-left text-ink/50">
            <th className="px-3 py-2 font-bold">类型</th>
            <th className="px-3 py-2 font-bold">名称</th>
            <th className="px-3 py-2 font-bold">结果</th>
            <th className="px-3 py-2 font-bold">耗时</th>
            <th className="px-3 py-2 font-bold">结论</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.kind}-${row.name}-${i}`} className="border-t border-primary/5">
              <td className="px-3 py-2 font-bold text-primary">{callKindLabel(row.kind)}</td>
              <td className="px-3 py-2 font-bold text-primary">{row.nameZh}</td>
              <td className="px-3 py-2">
                <span className={`rounded border px-1.5 py-0.5 font-bold ${callStatusTone(row.status)}`}>{row.statusZh}</span>
              </td>
              <td className="px-3 py-2 text-ink/50">{row.durationMs != null ? `${row.durationMs}ms` : "—"}</td>
              <td className="px-3 py-2 text-ink/70 max-w-[200px]">{row.conclusion || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CallReportPanel({ calls, title = "执行摘要" }: { calls?: Record<string, unknown>; title?: string }) {
  const [showTechnical, setShowTechnical] = useState(false);
  const rows = flattenCalls(calls);
  const { knowledge, checks, external } = groupRows(rows);

  if (rows.length === 0) {
    return (
      <section>
        <p className="text-xs font-bold text-ink/40 mb-2">{title}</p>
        <p className="text-sm text-ink/40 rounded-lg bg-surface/50 px-3 py-2">本步骤未触发知识检索或外部依赖，结论来自静态规则检查</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <p className="text-xs font-bold text-ink/40">{title}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-ink/50">知识依据</p>
          {knowledge.length === 0 ? <p className="text-xs text-ink/40">无知识召回</p> : knowledge.map((r, i) => <BusinessCallCard key={i} row={r} />)}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-ink/50">自动检查</p>
          {checks.length === 0 ? <p className="text-xs text-ink/40">无额外检查</p> : checks.map((r, i) => <BusinessCallCard key={i} row={r} />)}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-ink/50">外部依赖</p>
          {external.length === 0 ? <p className="text-xs text-ink/40">无外部调用</p> : external.map((r, i) => <BusinessCallCard key={i} row={r} />)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowTechnical((v) => !v)}
        className="text-xs font-bold text-accent hover:underline"
      >
        {showTechnical ? "收起技术详情" : "展开技术详情"}
      </button>
      {showTechnical && <CallTable rows={rows} />}
    </section>
  );
}

export function CallSummaryChips({ calls }: { calls?: Record<string, unknown> }) {
  const rows = flattenCalls(calls);
  if (rows.length === 0) return null;
  const labels = rows.slice(0, 2).map((r) => `${callKindLabel(r.kind)} ${r.statusZh}`);
  return <span className="text-[10px] text-ink/50 truncate">{labels.join(" · ")}</span>;
}

export { nodeConclusion } from "@/lib/callReport";
