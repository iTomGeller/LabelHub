"use client";

import { useState, useEffect } from "react";

export function AiDrawer() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<{ status: string; model: string; api_key_set: string } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setHealthError(null);
    fetch("/agent-api/agents/health")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setHealth)
      .catch((e) => setHealthError(e.message));
  }, [open]);

  async function handleQuickGenerate() {
    setGenerating(true);
    setLastResult(null);
    try {
      const res = await fetch("/agent-api/agents/generate-task-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: `task_${Date.now()}`,
          taskName: "快速测试任务",
          instruction: "测试 AI 连接是否正常",
          sampleData: [{ text: "测试数据", id: "001" }],
          traceId: `trace_${Date.now()}`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLastResult(`生成成功：${data.schemaComponents?.length || 0} 个组件，${data.rubricRules?.length || 0} 条规则\n\n${data.rationale || ""}`);
    } catch (e) {
      setLastResult(`生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg hover:bg-accent/90 transition"
        aria-label="打开 AI 助手"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <aside className="fixed bottom-0 right-0 top-0 z-50 w-[380px] overflow-y-auto border-l border-primary/15 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-primary">AI 助手</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink/40 hover:bg-surface hover:text-primary">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Connection Status */}
            <section className="mt-4 rounded-xl border border-primary/10 bg-surface/50 p-4">
              <h3 className="text-sm font-bold text-primary">DeepSeek 连接状态</h3>
              {healthError ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-danger" />
                  <span className="text-sm text-danger">离线：{healthError}</span>
                </div>
              ) : health ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${health.api_key_set === "yes" ? "bg-success" : "bg-warning"}`} />
                    <span className={`text-sm font-bold ${health.api_key_set === "yes" ? "text-success" : "text-warning"}`}>
                      {health.api_key_set === "yes" ? "在线" : "服务在线，Key 未配置"}
                    </span>
                  </div>
                  <p className="text-xs text-ink/60">模型：{health.model}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink/40">检查中…</p>
              )}
            </section>

            {/* Quick Actions */}
            <section className="mt-5">
              <h3 className="text-sm font-bold text-primary">快捷操作</h3>
              <div className="mt-3 space-y-2">
                <button
                  onClick={handleQuickGenerate}
                  disabled={generating}
                  className="w-full rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-left hover:border-accent transition disabled:opacity-50"
                >
                  <p className="text-sm font-bold text-accent">{generating ? "生成中…" : "测试 AI 生成"}</p>
                  <p className="text-xs text-ink/50">发送测试数据验证 DeepSeek 连接和生成能力</p>
                </button>
                <a href="/?view=task" className="block rounded-xl border border-primary/10 bg-surface/30 px-4 py-3 hover:border-accent transition">
                  <p className="text-sm font-bold text-primary">创建新任务</p>
                  <p className="text-xs text-ink/50">进入 4 步任务配置流程</p>
                </a>
                <a href="/?view=settings" className="block rounded-xl border border-primary/10 bg-surface/30 px-4 py-3 hover:border-accent transition">
                  <p className="text-sm font-bold text-primary">查看 AI 状态</p>
                  <p className="text-xs text-ink/50">服务状态、调用统计、监控看板</p>
                </a>
              </div>
            </section>

            {/* Last Result */}
            {lastResult && (
              <section className="mt-5 rounded-xl border border-accent/20 bg-accent/5 p-4">
                <h3 className="text-sm font-bold text-accent">生成结果</h3>
                <p className="mt-2 text-xs text-ink/70 whitespace-pre-wrap">{lastResult}</p>
              </section>
            )}

            {/* Workflow Guide */}
            <section className="mt-5">
              <h3 className="text-sm font-bold text-primary">使用指南</h3>
              <div className="mt-3 space-y-2 text-sm text-ink/70">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">1</span>
                  <span>填写任务名称和说明，导入样例数据（JSON/JSONL/CSV）</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">2</span>
                  <span>点击"AI 一键配置"自动生成模板和规则，或手动从预设添加</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">3</span>
                  <span>编辑选项、正反例、关联组件等详细属性</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">4</span>
                  <span>确认发布，B/C 模块即可通过 API 消费任务包</span>
                </div>
              </div>
            </section>

            {/* B/C API */}
            <section className="mt-5 rounded-xl border border-primary/10 bg-surface/30 p-4">
              <h3 className="text-sm font-bold text-primary">B/C 模块 API</h3>
              <div className="mt-2 space-y-1 text-xs font-mono text-ink/70">
                <p className="rounded bg-white px-2 py-1.5 border border-primary/5">GET /api/tasks/{"{id}"}/package</p>
                <p className="rounded bg-white px-2 py-1.5 border border-primary/5">GET /api/tasks/{"{id}"}/schema/current</p>
                <p className="rounded bg-white px-2 py-1.5 border border-primary/5">GET /api/tasks/{"{id}"}/instructions</p>
                <p className="rounded bg-white px-2 py-1.5 border border-primary/5">GET /api/tasks/{"{id}"}/items/next</p>
              </div>
            </section>
          </aside>
        </>
      )}
    </>
  );
}
