"use client";

import { flattenCalls, callKindLabel, callStatusTone, type CallRecord } from "@/lib/callReport";
import { nodeConclusion } from "@/lib/callReport";

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
            <th className="px-3 py-2 font-bold">退出码</th>
            <th className="px-3 py-2 font-bold">结论</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.kind}-${row.name}-${i}`} className="border-t border-primary/5">
              <td className="px-3 py-2 font-bold text-primary">{callKindLabel(row.kind)}</td>
              <td className="px-3 py-2">
                <span className="font-bold text-primary">{row.nameZh}</span>
                {row.name !== row.nameZh && (
                  <span className="block text-[10px] text-ink/30 font-mono truncate max-w-[140px]" title={row.name}>{row.name}</span>
                )}
              </td>
              <td className="px-3 py-2">
                <span className={`rounded border px-1.5 py-0.5 font-bold ${callStatusTone(row.status)}`}>{row.statusZh}</span>
              </td>
              <td className="px-3 py-2 text-ink/50">{row.durationMs != null ? `${row.durationMs}ms` : "—"}</td>
              <td className="px-3 py-2 text-ink/50">{row.exitCode != null ? row.exitCode : "—"}</td>
              <td className="px-3 py-2 text-ink/70 max-w-[200px]">{row.conclusion || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CallReportPanel({ calls, title = "执行调用明细" }: { calls?: Record<string, unknown>; title?: string }) {
  const rows = flattenCalls(calls);
  if (rows.length === 0) {
    return (
      <section>
        <p className="text-xs font-bold text-ink/40 mb-2">{title}</p>
        <p className="text-sm text-ink/40 rounded-lg bg-surface/50 px-3 py-2">本节点无额外调用记录（或未触发知识库/工具/技能/MCP）</p>
      </section>
    );
  }
  return (
    <section>
      <p className="text-xs font-bold text-ink/40 mb-2">{title}</p>
      <CallTable rows={rows} />
    </section>
  );
}

export function CallSummaryChips({ calls }: { calls?: Record<string, unknown> }) {
  const rows = flattenCalls(calls);
  if (rows.length === 0) return <span className="text-[9px] text-ink/40">无调用</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {rows.slice(0, 3).map((row, i) => (
        <span key={`${row.kind}-${i}`} className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${callStatusTone(row.status)}`} title={row.name}>
          {callKindLabel(row.kind)} · {row.nameZh}
        </span>
      ))}
      {rows.length > 3 && <span className="text-[9px] text-ink/40">+{rows.length - 3}</span>}
    </div>
  );
}

export { nodeConclusion } from "@/lib/callReport";
