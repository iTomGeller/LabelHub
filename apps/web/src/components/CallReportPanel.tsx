"use client";

import { flattenCalls, callKindLabel, callStatusTone, type CallRecord } from "@/lib/callReport";

function CallRow({ row }: { row: CallRecord }) {
  return (
    <div className="rounded-lg border border-primary/10 bg-white p-3 text-xs space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-primary/10 bg-surface px-2 py-0.5 font-bold text-primary">{callKindLabel(row.kind)}</span>
        <span className="font-mono text-primary">{row.name}</span>
        <span className={`rounded border px-2 py-0.5 font-bold ${callStatusTone(row.status)}`}>{row.status}</span>
        {row.durationMs != null && <span className="text-ink/40">{row.durationMs}ms</span>}
        {row.exitCode != null && <span className="text-ink/40">exit {row.exitCode}</span>}
      </div>
      {row.detail && <p className="text-ink/70">{row.detail}</p>}
      {Array.isArray(row.findings) && row.findings.length > 0 && (
        <ul className="list-disc list-inside text-ink/70 space-y-1">
          {row.findings.map((f, i) => <li key={i}>{String(f)}</li>)}
        </ul>
      )}
    </div>
  );
}

export function CallReportPanel({ calls, title = "执行调用明细" }: { calls?: Record<string, unknown>; title?: string }) {
  const rows = flattenCalls(calls);
  if (rows.length === 0) {
    return (
      <section>
        <p className="text-xs font-bold text-ink/40 mb-2">{title}</p>
        <p className="text-sm text-ink/40">本节点无 RAG / Skill / Tool / Sandbox / MCP 调用记录</p>
      </section>
    );
  }

  return (
    <section>
      <p className="text-xs font-bold text-ink/40 mb-2">{title}</p>
      <div className="space-y-2">
        {rows.map((row, i) => <CallRow key={`${row.kind}-${row.name}-${i}`} row={row} />)}
      </div>
    </section>
  );
}

export function CallSummaryChips({ calls }: { calls?: Record<string, unknown> }) {
  const rows = flattenCalls(calls);
  if (rows.length === 0) return <span className="text-[9px] text-ink/40">无调用</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {rows.slice(0, 4).map((row, i) => (
        <span key={`${row.kind}-${i}`} className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${callStatusTone(row.status)}`}>
          {callKindLabel(row.kind)} · {row.name}
        </span>
      ))}
      {rows.length > 4 && <span className="text-[9px] text-ink/40">+{rows.length - 4}</span>}
    </div>
  );
}
