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

export function AgentTraceView({ traceId }: { traceId?: string }) {
  const [data, setData] = useState<AgentRunData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!traceId) return;
    setLoading(true);
    fetch(`/agent-api/agents/audit-runs/${traceId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [traceId]);

  if (!traceId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-ink/40">
        <p className="text-lg font-bold">Agent Trace 查看器</p>
        <p className="mt-2 text-sm">请从任务审核结果中打开 trace 链接</p>
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
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
        加载失败: {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a href="/?view=list" className="text-sm text-ink/50 hover:text-accent">← 返回任务列表</a>
        <span className="text-ink/20">/</span>
        <span className="text-sm font-bold text-primary">Agent 执行 Trace</span>
      </div>

      <div className="rounded-2xl border border-primary/10 bg-white p-4">
        <div className="grid grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-ink/40">任务 ID</span>
            <p className="font-mono text-primary">{data.taskId}</p>
          </div>
          <div>
            <span className="text-ink/40">状态</span>
            <p className={data.status === "success" ? "text-success font-bold" : "text-warning font-bold"}>{data.status}</p>
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

      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <AgentTraceDag nodes={data.developerDag || []} traceId={traceId} />
      </div>
    </div>
  );
}
