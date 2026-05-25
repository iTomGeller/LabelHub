"use client";

import { useState } from "react";
import {
  groupTraceNodes,
  groupHasRisk,
  groupMatchesFilter,
  type AgentExecutionGroup,
  type TraceNode,
} from "@/lib/traceExecution";

interface Props {
  nodes: TraceNode[];
  traceId: string;
  runStatus?: string;
  traceCompleteness?: boolean;
}

const FILTER_OPTIONS = [
  { key: "all", label: "全部" },
  { key: "risk", label: "有风险" },
  { key: "rag_empty", label: "RAG 空召回" },
  { key: "tool_error", label: "Tool 异常" },
  { key: "mcp_error", label: "MCP 异常" },
  { key: "skill_findings", label: "Skill findings" },
] as const;

function statusBadge(status: string) {
  if (status === "success") return "bg-success/10 text-success border-success/20";
  if (status === "warning") return "bg-warning/10 text-warning border-warning/20";
  return "bg-danger/10 text-danger border-danger/20";
}

function emptyStateMessage(runStatus?: string, traceCompleteness?: boolean, groupCount?: number) {
  if (runStatus === "running") {
    return { title: "审核仍在运行", detail: "Agent 执行组将在审核完成后写入，请稍后刷新。" };
  }
  if (groupCount === 0 && runStatus === "partial") {
    return { title: "Trace 保存失败", detail: "运行时产生了结果但数据库持久化失败，请重新执行审核。" };
  }
  if (groupCount === 0) {
    return { title: "Trace 执行组为空", detail: "未找到 Agent 执行组，可能是旧版数据或持久化异常。" };
  }
  if (traceCompleteness === false) {
    return { title: "Trace 不完整", detail: "部分 Agent 执行组缺失，请查看上方完整性提示。" };
  }
  return { title: "暂无匹配执行组", detail: "当前筛选条件下没有可展示的 Agent 执行组。" };
}

function CallChip({ label, tone, detail }: { label: string; tone: string; detail?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${tone}`}>
      {label}
      {detail && <span className="font-normal opacity-70">{detail}</span>}
    </span>
  );
}

function ExecutionTimeline({ group }: { group: AgentExecutionGroup }) {
  const rag = group.calls.rag as Record<string, unknown> | undefined;
  const skills = group.calls.skills as Record<string, unknown> | undefined;
  const tools = group.calls.tools || [];
  const sandbox = group.calls.sandbox || [];
  const mcp = group.calls.mcp || [];

  const items: { key: string; label: string; tone: string; body?: string }[] = [];

  if (rag) {
    const hit = rag.hasContent === true;
    items.push({
      key: "rag",
      label: hit ? "RAG 命中" : "RAG 空召回",
      tone: hit ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800",
      body: hit ? `${String(rag.charCount || 0)} 字` : "知识库未命中，置信度低",
    });
  }
  if (skills && skills.used) {
    const count = Number(skills.findingCount || 0);
    items.push({
      key: "skill",
      label: `Skill ×${((skills.skills as string[]) || []).length}`,
      tone: count > 0 ? "border-orange-200 bg-orange-50 text-orange-800" : "border-orange-100 bg-orange-50/50 text-orange-700",
      body: count > 0 ? `${count} findings` : "无 findings",
    });
  }
  for (const t of tools) {
    const ok = t.status === "success";
    items.push({
      key: `tool-${String(t.tool || items.length)}`,
      label: `Tool · ${String(t.tool || "call")}`,
      tone: ok ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-800",
      body: `${String(t.durationMs || 0)}ms · ${String(t.status || "?")}`,
    });
  }
  for (const s of sandbox) {
    const ok = s.status === "success";
    items.push({
      key: `sandbox-${String(s.tool || items.length)}`,
      label: `Sandbox · ${String(s.tool || "exec")}`,
      tone: ok ? "border-rose-200 bg-rose-50 text-rose-800" : "border-red-200 bg-red-50 text-red-800",
      body: `exit ${String(s.exitCode ?? "?")}`,
    });
  }
  for (const m of mcp) {
    const ok = m.status === "available";
    items.push({
      key: `mcp-${String(m.server || items.length)}`,
      label: `MCP · ${String(m.server || "?")}`,
      tone: ok ? "border-cyan-200 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-slate-50 text-slate-600",
      body: String(m.status || "?"),
    });
  }

  if (items.length === 0) {
    return <p className="text-[10px] text-ink/40">本 Agent 无附加调用事件</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <CallChip key={item.key} label={item.label} tone={item.tone} detail={item.body} />
      ))}
    </div>
  );
}

function GroupDetail({ group, onClose }: { group: AgentExecutionGroup; onClose: () => void }) {
  const rag = group.calls.rag as Record<string, unknown> | undefined;
  const skills = group.calls.skills as Record<string, unknown> | undefined;

  return (
    <div className="rounded-xl border border-accent/20 bg-surface/30 p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-bold text-primary">{group.title}</span>
          <p className="text-[10px] font-mono text-ink/40">{group.agent} · {group.nodeKey} · seq {group.sequence}</p>
        </div>
        <button onClick={onClose} className="text-ink/40 hover:text-primary shrink-0">收起</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><span className="text-ink/40">状态</span><p className={group.status === "success" ? "text-success" : "text-warning"}>{group.status}</p></div>
        <div><span className="text-ink/40">耗时</span><p className="font-mono">{group.durationMs}ms</p></div>
        <div><span className="text-ink/40">风险</span><p>{groupHasRisk(group) ? "有" : "无"}</p></div>
      </div>
      {rag && (
        <div>
          <span className="text-ink/40 font-bold">RAG</span>
          {rag.hasContent ? (
            <p className="mt-1 bg-emerald-50 rounded p-2 font-mono text-[11px] whitespace-pre-wrap break-words">
              {String(rag.context || "").substring(0, 400)}
            </p>
          ) : (
            <p className="mt-1 text-warning bg-warning/5 rounded p-2">空召回 — 知识库为空或未命中</p>
          )}
        </div>
      )}
      {skills && Boolean(skills.used) && (
        <div>
          <span className="text-ink/40 font-bold">Skills</span>
          <p className="mt-1">{((skills.skills as string[]) || []).join(", ")}</p>
          {Array.isArray(skills.findings) && (
            <ul className="mt-1 list-disc list-inside text-ink/70">
              {(skills.findings as string[]).map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          )}
        </div>
      )}
      {(group.calls.tools?.length || 0) > 0 && (
        <div>
          <span className="text-ink/40 font-bold">ToolCall</span>
          <pre className="mt-1 bg-amber-50 rounded p-2 overflow-x-auto text-[10px]">{JSON.stringify(group.calls.tools, null, 2)}</pre>
        </div>
      )}
      {(group.calls.sandbox?.length || 0) > 0 && (
        <div>
          <span className="text-ink/40 font-bold">Sandbox</span>
          <pre className="mt-1 bg-rose-50 rounded p-2 overflow-x-auto text-[10px]">{JSON.stringify(group.calls.sandbox, null, 2)}</pre>
        </div>
      )}
      {(group.calls.mcp?.length || 0) > 0 && (
        <div>
          <span className="text-ink/40 font-bold">MCP</span>
          <pre className="mt-1 bg-cyan-50 rounded p-2 overflow-x-auto text-[10px]">{JSON.stringify(group.calls.mcp, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export function AgentTraceDag({ nodes, traceId, runStatus, traceCompleteness }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const groups = groupTraceNodes(nodes);
  const visibleGroups = groups.filter((g) => groupMatchesFilter(g, filter));
  const emptyMsg = emptyStateMessage(runStatus, traceCompleteness, groups.length);
  const riskCount = groups.filter(groupHasRisk).length;
  const ragEmptyCount = groups.filter((g) => groupMatchesFilter(g, "rag_empty")).length;

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <h3 className="text-lg font-bold text-primary">Agent 执行 Trace</h3>
        <p className="text-xs text-ink/50">按 Agent 执行顺序展示，RAG / Skill / Tool / Sandbox / MCP 绑定在对应 Agent 内部</p>
        <p className="text-xs text-ink/50 font-mono break-all mt-1">traceId: {traceId}</p>
      </div>

      {ragEmptyCount > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning">
          知识库未命中：{ragEmptyCount} 个 Agent RAG 空召回，当前审核基于静态规则，置信度低
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {FILTER_OPTIONS.map((opt) => {
          const count = opt.key === "all" ? groups.length
            : opt.key === "risk" ? riskCount
            : groups.filter((g) => groupMatchesFilter(g, opt.key)).length;
          return (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === opt.key ? "bg-accent text-white" : "bg-surface text-ink/60"}`}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {visibleGroups.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm font-bold text-ink/60">{emptyMsg.title}</p>
            <p className="text-xs text-ink/40 max-w-md mx-auto">{emptyMsg.detail}</p>
          </div>
        )}
        {visibleGroups.map((group, idx) => (
          <div key={group.traceNodeId || `${group.agent}-${idx}`} className="rounded-xl border border-primary/10 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedGroup(expandedGroup === group.traceNodeId ? null : group.traceNodeId)}
              className="w-full text-left px-4 py-3 hover:bg-surface/30 transition"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                  {group.sequence || idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-primary">{group.title}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${statusBadge(group.status)}`}>{group.status}</span>
                    {groupHasRisk(group) && <span className="text-[10px] text-warning font-bold">有风险</span>}
                  </div>
                  <p className="text-[10px] font-mono text-ink/40 mt-0.5">{group.agent} · {group.nodeKey} · {group.durationMs}ms</p>
                  <div className="mt-2">
                    <ExecutionTimeline group={group} />
                  </div>
                </div>
                {idx < visibleGroups.length - 1 && (
                  <span className="hidden sm:block text-ink/20 text-lg self-center">↓</span>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>

      {expandedGroup && (() => {
        const group = groups.find((g) => g.traceNodeId === expandedGroup);
        if (!group) return null;
        return <GroupDetail group={group} onClose={() => setExpandedGroup(null)} />;
      })()}
    </div>
  );
}
