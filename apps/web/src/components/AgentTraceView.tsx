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
  traceCompleteness?: boolean;
  missingNodes?: string[];
}

interface RecentRun {
  trace_id: string;
  task_id: string;
  config_hash: string;
  status: string;
  from_cache: boolean;
  finished_at: string;
  trace_completeness?: boolean | number | null;
  business_node_count?: number;
  developer_node_count?: number;
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-w-0">
              {recentRuns.map((run) => {
                const bizCount = Number(run.business_node_count ?? 0);
                const devCount = Number(run.developer_node_count ?? 0);
                const complete = run.trace_completeness === true || run.trace_completeness === 1;
                return (
                  <div key={run.trace_id} className="rounded-xl border border-primary/10 bg-surface/30 p-4 transition hover:border-accent/30 flex flex-col gap-3 min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink/40 mb-1">Trace ID</p>
                        <p className="font-mono text-xs text-primary truncate">{run.trace_id}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        run.status === "success" ? "bg-success/10 text-success" : run.status === "partial" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                      }`}>
                        {run.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="text-ink/40">任务</span>
                        <p className="font-mono truncate text-primary">{run.task_id}</p>
                      </div>
                      <div className="min-w-0">
                        <span className="text-ink/40">缓存命中</span>
                        <p className="text-primary">{run.from_cache ? "是" : "否"}</p>
                      </div>
                      <div className="min-w-0">
                        <span className="text-ink/40">业务节点</span>
                        <p className="text-primary">{bizCount}/6</p>
                      </div>
                      <div className="min-w-0">
                        <span className="text-ink/40">Trace 节点</span>
                        <p className="text-primary">{devCount}</p>
                      </div>
                    </div>
                    <div className="text-xs">
                      <span className="text-ink/40">Trace 完整性</span>
                      <p className={complete ? "text-success font-bold" : "text-warning font-bold"}>
                        {complete ? "完整" : bizCount === 0 && devCount === 0 ? "保存失败" : "不完整"}
                      </p>
                    </div>
                    <div className="text-xs">
                      <span className="text-ink/40">完成时间</span>
                      <p className="text-ink/80">{run.finished_at || "—"}</p>
                    </div>
                    <div className="mt-1 pt-3 border-t border-primary/10">
                      <a
                        href={`/?view=trace&traceId=${encodeURIComponent(run.trace_id)}`}
                        className="block w-full text-center rounded-lg bg-white border border-accent/20 px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent hover:text-white"
                      >
                        查看 Trace 详情
                      </a>
                    </div>
                  </div>
                );
              })}
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

  const bizCount = data.businessDag?.length ?? 0;
  const devCount = data.developerDag?.length ?? 0;
  const isRunning = data.status === "running";
  const isPersistFailed = bizCount === 0 && devCount === 0 && !isRunning;
  const isIncomplete = data.traceCompleteness === false || (bizCount > 0 && bizCount < 6);

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <a href="/?view=trace" className="text-sm text-ink/50 hover:text-accent">
          ← 返回 Trace 列表
        </a>
        <span className="text-ink/20">/</span>
        <span className="text-sm font-bold text-primary">Agent 执行 Trace</span>
      </div>

      {(isPersistFailed || isIncomplete) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          isPersistFailed ? "border-danger/30 bg-danger/5 text-danger" : "border-warning/30 bg-warning/5 text-warning"
        }`}>
          {isRunning && "审核仍在运行中，Trace 节点尚未生成。"}
          {isPersistFailed && "Trace 保存失败：运行时结果未写入数据库，请重新执行审核或联系管理员。"}
          {!isRunning && !isPersistFailed && isIncomplete && (
            <>Trace 不完整：业务节点 {bizCount}/6，开发者节点 {devCount}。缺失: {(data.missingNodes || []).join("、") || "未知"}</>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-primary/10 bg-white p-4">
        <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-5">
          <div>
            <span className="text-ink/40">任务 ID</span>
            <p className="font-mono text-primary break-all">{data.taskId}</p>
          </div>
          <div>
            <span className="text-ink/40">状态</span>
            <p className={data.status === "success" ? "text-success font-bold" : data.status === "partial" ? "text-danger font-bold" : "text-warning font-bold"}>
              {data.status}
            </p>
          </div>
          <div>
            <span className="text-ink/40">Trace 完整性</span>
            <p className={data.traceCompleteness ? "text-success font-bold" : "text-warning font-bold"}>
              {data.traceCompleteness ? "完整" : "不完整"}
            </p>
          </div>
          <div>
            <span className="text-ink/40">节点数</span>
            <p className="font-mono">业务 {bizCount} / 开发者 {devCount}</p>
          </div>
          <div>
            <span className="text-ink/40">Config Hash</span>
            <p className="font-mono truncate">{data.configHash}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/10 bg-white p-6 min-w-0 overflow-x-auto">
        <AgentTraceDag
          nodes={data.developerDag || []}
          traceId={traceId}
          runStatus={data.status}
          traceCompleteness={data.traceCompleteness}
        />
      </div>
    </div>
  );
}
