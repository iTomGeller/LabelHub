"use client";

import { callKindLabel, callStatusTone, flattenCalls } from "@/lib/callReport";
import type { AgentExecutionGroup } from "@/lib/traceExecution";

const SPAN_ORDER = ["rag", "skill", "tool", "sandbox", "mcp"] as const;

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

export function TraceSpanTimeline({ group }: { group: AgentExecutionGroup }) {
  const rows = flattenCalls(group.calls as Record<string, unknown>);
  const totalMs = Math.max(group.durationMs, 1);

  if (rows.length === 0) {
    return <p className="text-xs text-ink/40">无内部调用记录</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-ink/50">耗时瀑布 · 总计 {group.durationMs}ms</p>
      {rows.map((row, i) => {
        const ms = row.durationMs ?? Math.round(totalMs / rows.length);
        const pct = Math.min(100, Math.round((ms / totalMs) * 100));
        return (
          <div key={`${row.kind}-${i}`} className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-primary">{spanLabel(row.kind)} · {row.nameZh}</span>
              <span className={`rounded border px-1 py-0.5 font-bold ${callStatusTone(row.status)}`}>{row.statusZh}</span>
            </div>
            <div className="h-2 rounded-full bg-surface overflow-hidden">
              <div className="h-full bg-accent/70 rounded-full" style={{ width: `${Math.max(pct, 8)}%` }} />
            </div>
            <p className="text-[10px] text-ink/60">{row.conclusion}</p>
          </div>
        );
      })}
    </div>
  );
}

export function TraceCallGraph({ group }: { group: AgentExecutionGroup }) {
  const rows = flattenCalls(group.calls as Record<string, unknown>);
  const ordered = [...rows].sort((a, b) => SPAN_ORDER.indexOf(a.kind as typeof SPAN_ORDER[number]) - SPAN_ORDER.indexOf(b.kind as typeof SPAN_ORDER[number]));

  if (ordered.length === 0) {
    return null;
  }

  const ragEmpty = ordered.some((r) => r.kind === "rag" && r.status === "empty");
  const mcpDown = ordered.some((r) => r.kind === "mcp" && r.status === "unavailable");

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-ink/50">内部调用链</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-primary/15 bg-white px-2 py-1 text-[10px] font-bold text-primary">输入摘要</span>
        {ordered.map((row, i) => (
          <div key={`${row.kind}-${i}`} className="flex items-center gap-2">
            <span className="text-ink/30">→</span>
            <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${callStatusTone(row.status)}`}>
              {callKindLabel(row.kind)}
            </span>
          </div>
        ))}
        <span className="text-ink/30">→</span>
        <span className="rounded-lg border border-primary/15 bg-white px-2 py-1 text-[10px] font-bold text-primary">输出摘要</span>
      </div>
      {(ragEmpty || mcpDown) && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[10px] text-warning">
          {ragEmpty && "RAG 空召回 → 静态规则兜底 → 低置信通过"}
          {ragEmpty && mcpDown && " · "}
          {mcpDown && "MCP 不可用 → 跳过外部增强"}
        </div>
      )}
      <div className="grid gap-2">
        {ordered.map((row, i) => (
          <div key={`detail-${row.kind}-${i}`} className="rounded-lg bg-surface/50 px-3 py-2 text-xs">
            <span className="font-bold text-primary">{spanLabel(row.kind)}</span>
            <span className="text-ink/50"> — {row.conclusion}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
