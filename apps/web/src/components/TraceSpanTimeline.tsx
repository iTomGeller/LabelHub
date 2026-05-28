"use client";

import { useState } from "react";
import { callKindLabel, callStatusTone, flattenCalls } from "@/lib/callReport";
import { KeyValueViewer } from "./KeyValueViewer";
import { Pagination, paginateSlice } from "./Pagination";
import type { AgentExecutionGroup } from "@/lib/traceExecution";

const SPANS_PER_PAGE = 4;
const JSON_LINES_PER_PAGE = 80;

function spanLabel(kind: string) {
  switch (kind) {
    case "rag": return "RAG 检索";
    case "skill": return "Skill 执行";
    case "tool": return "Tool 调用";
    case "sandbox": return "Sandbox";
    case "mcp": return "MCP 探测";
    default: return kind;
  }
}

export function TraceSpanTimeline({ group, page, onPageChange }: {
  group: AgentExecutionGroup;
  page?: number;
  onPageChange?: (p: number) => void;
}) {
  const [internalPage, setInternalPage] = useState(1);
  const spanPage = page ?? internalPage;
  const setSpanPage = onPageChange ?? setInternalPage;
  const rows = flattenCalls(group.calls as Record<string, unknown>);
  const paged = paginateSlice(rows, spanPage, SPANS_PER_PAGE);
  const totalMs = Math.max(group.durationMs, 1);

  if (rows.length === 0) {
    return <p className="text-xs text-ink/40">无内部调用记录</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-ink/50">耗时瀑布 · 总计 {group.durationMs}ms</p>
      {paged.items.map((row, i) => {
        const ms = row.durationMs ?? Math.round(totalMs / rows.length);
        const pct = Math.min(100, Math.round((ms / totalMs) * 100));
        return (
          <div key={`${row.kind}-${i}`} className="space-y-1 rounded-lg border border-primary/10 bg-white/60 p-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-primary">{spanLabel(row.kind)} · {row.nameZh}</span>
              <span className={`rounded border px-1 py-0.5 font-bold ${callStatusTone(row.status)}`}>{row.statusZh}</span>
            </div>
            <div className="h-2 rounded-full bg-surface overflow-hidden">
              <div className="h-full bg-accent/70 rounded-full" style={{ width: `${Math.max(pct, 8)}%` }} />
            </div>
            {row.whyCalled && <p className="text-[10px] text-ink/50">为什么调用：{row.whyCalled}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold text-ink/40">输入</p>
                <KeyValueViewer data={row.inputPreview} maxTextLen={100} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-ink/40">输出</p>
                <KeyValueViewer data={row.outputPreview} maxTextLen={100} />
              </div>
            </div>
            <p className="text-[10px] text-ink/60">{row.resultSummary || row.conclusion}</p>
            {row.degradeReason && <p className="text-[10px] text-warning">降级：{row.degradeReason}</p>}
          </div>
        );
      })}
      <Pagination page={paged.page} totalPages={paged.totalPages} onPageChange={setSpanPage} label="Span 列表" />
    </div>
  );
}

export function TraceCallGraph({ group }: { group: AgentExecutionGroup }) {
  const rows = flattenCalls(group.calls as Record<string, unknown>);
  const inputPreview = group.raw?.inputPreview as Record<string, unknown> | undefined;
  const outputPreview = group.raw?.outputPreview as Record<string, unknown> | undefined;

  if (rows.length === 0 && !inputPreview && !outputPreview) {
    return null;
  }

  const ragEmpty = rows.some((r) => r.kind === "rag" && r.status === "empty");
  const mcpDown = rows.some((r) => r.kind === "mcp" && r.status === "unavailable");

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-ink/50">输入输出摘要</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-primary/10 bg-white/70 p-3">
          <p className="text-[10px] font-bold text-ink/40 mb-1">Agent 输入</p>
          <KeyValueViewer data={inputPreview} />
        </div>
        <div className="rounded-lg border border-primary/10 bg-white/70 p-3">
          <p className="text-[10px] font-bold text-ink/40 mb-1">Agent 输出</p>
          <KeyValueViewer data={outputPreview} />
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <p className="text-[10px] font-bold text-ink/50">内部调用链</p>
          <div className="flex flex-wrap items-center gap-2">
            {rows.map((row, i) => (
              <div key={`${row.kind}-${i}`} className="flex items-center gap-2">
                {i > 0 && <span className="text-ink/30">→</span>}
                <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${callStatusTone(row.status)}`}>
                  {callKindLabel(row.kind)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {(ragEmpty || mcpDown) && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[10px] text-warning">
          {ragEmpty && "RAG 空召回 → 静态规则兜底 → 低置信通过"}
          {ragEmpty && mcpDown && " · "}
          {mcpDown && "MCP 不可用 → 跳过外部增强"}
        </div>
      )}
    </div>
  );
}

export function PagedRawJson({ data }: { data: unknown }) {
  const [page, setPage] = useState(1);
  const text = JSON.stringify(data, null, 2);
  const lines = text.split("\n");
  const keys = data && typeof data === "object" && !Array.isArray(data)
    ? Object.keys(data as Record<string, unknown>)
    : null;

  if (keys && keys.length > 1) {
    const paged = paginateSlice(keys, page, 4);
    return (
      <div className="space-y-2">
        {paged.items.map((key) => (
          <details key={key} className="rounded-lg border border-primary/10 bg-white/80">
            <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-primary">{key}</summary>
            <pre className="text-[10px] px-3 pb-3 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify((data as Record<string, unknown>)[key], null, 2)}
            </pre>
          </details>
        ))}
        <Pagination page={paged.page} totalPages={paged.totalPages} onPageChange={setPage} label="JSON 分段" />
      </div>
    );
  }

  const linePaged = paginateSlice(lines, page, JSON_LINES_PER_PAGE);
  return (
    <div className="space-y-2">
      <pre className="text-[10px] bg-white/80 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
        {linePaged.items.join("\n")}
      </pre>
      <Pagination page={linePaged.page} totalPages={linePaged.totalPages} onPageChange={setPage} label="JSON 行" />
    </div>
  );
}
