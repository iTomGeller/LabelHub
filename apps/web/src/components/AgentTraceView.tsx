"use client";

import { useState, useEffect } from "react";
import { AgentTraceDag } from "./AgentTraceDag";

interface TraceNode {
  id: string;
  type: string;
  title: string;
  status: string;
  durationMs: number;
  inputPreview?: unknown;
  outputPreview?: unknown;
  prompt?: Record<string, unknown>;
  rag?: Record<string, unknown>;
  skill?: Record<string, unknown>;
  mcp?: Record<string, unknown>;
  sandbox?: Record<string, unknown>;
  children?: string[];
}

interface AgentRunData {
  traceId: string;
  taskId: string;
  configHash: string;
  status: string;
  fromCache: boolean;
  businessDag: unknown[];
  developerDag: TraceNode[];
  durationMs: number;
}

interface RecentRun {
  trace_id: string;
  task_id: string;
  config_hash: string;
  status: string;
  from_cache: boolean;
  finished_at: string;
}

export function AgentTraceView({ traceId }: { traceId?: string }) {
  const [data, setData] = useState<AgentRunData | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (traceId) return;
    setRecentLoading(true);
    fetch("/agent-api/agents/audit-runs/recent?limit=20")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setRecentRuns(Array.isArray(rows) ? rows : []))
      .catch(() => setRecentRuns([]))
      .finally(() => setRecentLoading(false));
  }, [traceId]);

  useEffect(() => {
    if (!traceId) return;
    setLoading(true);
    setError(null);
    fetch(`/agent-api/agents/audit-runs/${traceId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [traceId]);

  if (!traceId) {
    return (
      <div className="space-y-6 min-w-0">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">Agent Trace 查看器</h1>
          <p className="mt-1 text-sm text-ink/60">
            查看 AI 审核的执行链路，包括 Prompt、RAG、Skills、Sandbox 与 MCP 调用。
          </p>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-primary">最近审核记录</h2>
            <a href="/?view=list" className="text-sm text-accent font-bold hover:underline">
              前往任务列表
            </a>
          </div>

          {recentLoading ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              <p className="text-sm text-ink/50">加载最近 Trace…</p>
            </div>
          ) : recentRuns.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-ink/50">暂无审核记录</p>
              <p className="mt-2 text-xs text-ink/40">
                请打开任务发布页完成一次 AI 质量审核，或从审核结果中点击「查看开发者 Trace」
              </p>
              <a
                href="/?view=task&taskId=task_ner_002&step=publish"
                className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent/90"
              >
                打开示例任务发布页
              </a>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-primary/10 text-left text-xs text-ink/40">
                    <th className="pb-3 pr-4 font-bold">Trace ID</th>
                    <th className="pb-3 pr-4 font-bold">任务</th>
                    <th className="pb-3 pr-4 font-bold">状态</th>
                    <th className="pb-3 pr-4 font-bold">缓存</th>
                    <th className="pb-3 pr-4 font-bold">完成时间</th>
                    <th className="pb-3 font-bold">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => (
                    <tr key={run.trace_id} className="border-b border-primary/5 hover:bg-surface/40">
                      <td className="py-3 pr-4 font-mono text-xs text-primary">{run.trace_id}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{run.task_id}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            run.status === "success" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-ink/60">{run.from_cache ? "是" : "否"}</td>
                      <td className="py-3 pr-4 text-xs text-ink/60">{run.finished_at || "—"}</td>
                      <td className="py-3">
                        <a
                          href={`/?view=trace&traceId=${encodeURIComponent(run.trace_id)}`}
                          className="text-xs font-bold text-accent hover:underline"
                        >
                          查看 Trace
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        <p className="mt-3 text-sm text-ink/50">加载 Trace 数据…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          加载失败: {error}
        </div>
        <a href="/?view=trace" className="text-sm text-accent font-bold hover:underline">
          ← 返回 Trace 列表
        </a>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <a href="/?view=trace" className="text-sm text-ink/50 hover:text-accent">
          ← 返回 Trace 列表
        </a>
        <span className="text-ink/20">/</span>
        <span className="text-sm font-bold text-primary">Agent 执行 Trace</span>
      </div>

      <div className="rounded-2xl border border-primary/10 bg-white p-4">
        <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
          <div>
            <span className="text-ink/40">任务 ID</span>
            <p className="font-mono text-primary break-all">{data.taskId}</p>
          </div>
          <div>
            <span className="text-ink/40">状态</span>
            <p className={data.status === "success" ? "text-success font-bold" : "text-warning font-bold"}>
              {data.status}
            </p>
          </div>
          <div>
            <span className="text-ink/40">缓存</span>
            <p>{data.fromCache ? "是" : "否"}</p>
          </div>
          <div>
            <span className="text-ink/40">Config Hash</span>
            <p className="font-mono truncate">{data.configHash}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/10 bg-white p-6 min-w-0 overflow-x-auto">
        <AgentTraceDag nodes={data.developerDag || []} traceId={traceId} />
      </div>
    </div>
  );
}
