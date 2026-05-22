"use client";

import { useState, useEffect } from "react";

export function AiDrawer() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<{ status: string; model: string; api_key_set: boolean } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/agent-api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setHealthError(e.message));
  }, [open]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg hover:bg-accent/90 transition"
        aria-label="打开 AI 助手"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      </button>

      {/* Backdrop + Drawer */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <aside className="fixed bottom-0 right-0 top-0 z-50 w-[380px] overflow-y-auto border-l border-primary/15 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-primary">AI 助手</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-ink/40 hover:bg-surface hover:text-primary"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-sm text-success font-bold">在线</span>
                  </div>
                  <p className="text-xs text-ink/60">模型：{health.model}</p>
                  <p className="text-xs text-ink/60">API Key：{health.api_key_set ? "已配置" : "未配置"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink/40">检查中…</p>
              )}
            </section>

            {/* How it works */}
            <section className="mt-5">
              <h3 className="text-sm font-bold text-primary">工作流说明</h3>
              <div className="mt-3 space-y-2 text-sm text-ink/70">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">1</span>
                  <span>填写任务名称和说明，导入样例数据</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">2</span>
                  <span>点击【AI 一键配置】，DeepSeek 自动生成模板和规则</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">3</span>
                  <span>在步骤 2/3 中微调组件和规则</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">4</span>
                  <span>发布后，B/C 通过 API 消费 TaskPackage</span>
                </div>
              </div>
            </section>

            {/* B/C Integration */}
            <section className="mt-5 rounded-xl border border-accent/20 bg-accent/5 p-4">
              <h3 className="text-sm font-bold text-primary">B/C 模块消费接口</h3>
              <div className="mt-2 space-y-2 text-xs font-mono text-ink/70">
                <p className="rounded-lg bg-white px-3 py-2">GET /api/tasks/{"{taskId}"}/package</p>
                <p className="rounded-lg bg-white px-3 py-2">GET /api/tasks/{"{taskId}"}/schema/current</p>
                <p className="rounded-lg bg-white px-3 py-2">GET /api/tasks/{"{taskId}"}/instructions</p>
                <p className="rounded-lg bg-white px-3 py-2">GET /api/tasks/{"{taskId}"}/items/next</p>
              </div>
              <p className="mt-2 text-xs text-ink/50">B（标注工作台）和 C（审核工作台）调用以上接口获取任务配置。</p>
            </section>

            {/* Tips */}
            <section className="mt-5">
              <h3 className="text-sm font-bold text-primary">使用技巧</h3>
              <ul className="mt-2 space-y-1 text-sm text-ink/60 list-disc pl-4">
                <li>任务说明越详细，AI 生成质量越高</li>
                <li>导入 3-5 条样例数据可大幅提升生成效果</li>
                <li>AI 生成后所有字段均可手动调整</li>
                <li>质检规则的严重度会影响 Agent 预审行为</li>
              </ul>
            </section>
          </aside>
        </>
      )}
    </>
  );
}
