"use client";

import { callKindLabel, callStatusTone, flattenCalls, type CallRecord } from "@/lib/callReport";
import { KeyValueViewer } from "./KeyValueViewer";
import { Pagination, paginateSlice } from "./Pagination";
import { useState } from "react";

const SPANS_PER_PAGE = 3;

export function CallIoCard({ row }: { row: CallRecord }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-surface/40 p-4 space-y-3" data-testid="call-io-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-primary">{callKindLabel(row.kind)} · {row.nameZh}</span>
          {row.whyCalled && <p className="text-[10px] text-ink/50 mt-0.5">为什么调用：{row.whyCalled}</p>}
        </div>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${callStatusTone(row.status)}`}>{row.statusZh}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-primary/5 bg-white/70 p-3">
          <p className="text-[10px] font-bold text-ink/40 mb-1">输入</p>
          <KeyValueViewer data={row.inputPreview} maxTextLen={120} />
        </div>
        <div className="rounded-lg border border-primary/5 bg-white/70 p-3">
          <p className="text-[10px] font-bold text-ink/40 mb-1">输出</p>
          <KeyValueViewer data={row.outputPreview} maxTextLen={120} />
        </div>
      </div>

      <div className="rounded-lg bg-white/70 px-3 py-2">
        <p className="text-[10px] font-bold text-ink/40">结果影响</p>
        <p className="text-sm text-ink/80">{row.resultSummary || row.conclusion || "—"}</p>
        {row.degradeReason && (
          <p className="text-xs text-warning mt-1">降级原因：{row.degradeReason}</p>
        )}
      </div>

      {row.durationMs != null && row.durationMs > 0 && (
        <p className="text-[10px] text-ink/40">耗时 {row.durationMs}ms</p>
      )}
    </div>
  );
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
              <td className="px-3 py-2 text-ink/70 max-w-[200px]">{row.resultSummary || row.conclusion || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CallReportPanel({
  calls,
  title = "执行摘要",
  paginate = false,
}: {
  calls?: Record<string, unknown>;
  title?: string;
  paginate?: boolean;
}) {
  const [showTechnical, setShowTechnical] = useState(false);
  const [spanPage, setSpanPage] = useState(1);
  const rows = flattenCalls(calls);
  const paged = paginate ? paginateSlice(rows, spanPage, SPANS_PER_PAGE) : { page: 1, totalPages: 1, items: rows };

  if (rows.length === 0) {
    return (
      <section>
        <p className="text-xs font-bold text-ink/40 mb-2">{title}</p>
        <p className="text-sm text-ink/40 rounded-lg bg-surface/50 px-3 py-2">本步骤未触发知识检索或外部依赖，结论来自静态规则检查</p>
      </section>
    );
  }

  return (
    <section className="space-y-3" data-testid="call-report-panel">
      <p className="text-xs font-bold text-ink/40">{title}</p>
      <div className="space-y-3">
        {paged.items.map((row, i) => (
          <CallIoCard key={`${row.id || row.kind}-${i}`} row={row} />
        ))}
      </div>
      {paginate && (
        <Pagination page={paged.page} totalPages={paged.totalPages} onPageChange={setSpanPage} label="调用证据" />
      )}
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
