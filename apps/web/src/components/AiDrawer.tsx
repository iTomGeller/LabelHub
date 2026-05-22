"use client";

import { useState } from "react";
import type { SchemaRiskReport } from "@labelhub/contracts";

const riskReport: SchemaRiskReport = {
  taskId: "task_text_cls_001",
  schemaVersionId: "schema_v1_text_cls",
  riskLevel: "medium",
  traceId: "trace_task_text_cls_001",
  findings: [
    {
      componentId: "reason",
      severity: "medium",
      message: "判断理由有最小长度校验，但缺少引用原文关键词的结构化检查。",
      recommendation: "为 reason 增加自定义校验或在质检规则中加入引用要求。"
    },
    {
      componentId: "llm_hint",
      severity: "low",
      message: "LLM 辅助组件已配置 Prompt，但未限制输出字段。",
      recommendation: "声明 outputPath 和可采纳字段。"
    }
  ]
};

export function AiDrawer() {
  const [open, setOpen] = useState(false);

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
            <p className="mt-1 text-sm text-ink/60">当前步骤的建议和风险提示。</p>

            {/* Risk Report */}
            <section className="mt-6 rounded-xl border border-warning/20 bg-warning/5 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-primary">发布前风险</h3>
                <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-bold text-warning">中风险</span>
              </div>
              <div className="mt-3 space-y-3">
                {riskReport.findings.map((f, i) => (
                  <div key={i} className="rounded-lg bg-white p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">{f.componentId}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        f.severity === "medium" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary/60"
                      }`}>
                        {f.severity}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-ink/70">{f.message}</p>
                    <p className="mt-1 text-sm font-medium text-accent">{f.recommendation}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Quick Actions */}
            <section className="mt-6">
              <h3 className="text-sm font-bold text-primary">快捷操作</h3>
              <div className="mt-3 grid gap-2">
                <button className="rounded-xl border border-primary/10 bg-surface px-4 py-3 text-left text-sm font-bold text-primary hover:border-accent">
                  生成模板草案
                </button>
                <button className="rounded-xl border border-primary/10 bg-surface px-4 py-3 text-left text-sm font-bold text-primary hover:border-accent">
                  优化任务说明
                </button>
                <button className="rounded-xl border border-primary/10 bg-surface px-4 py-3 text-left text-sm font-bold text-primary hover:border-accent">
                  草拟质检规则
                </button>
                <button className="rounded-xl border border-primary/10 bg-surface px-4 py-3 text-left text-sm font-bold text-primary hover:border-accent">
                  数据画像分析
                </button>
              </div>
            </section>

            {/* Tool Calls */}
            <section className="mt-6">
              <h3 className="text-sm font-bold text-primary">最近工具调用</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center justify-between text-ink/60">
                  <span>读取任务包</span>
                  <span className="text-xs text-success">42ms</span>
                </li>
                <li className="flex items-center justify-between text-ink/60">
                  <span>抽样数据集</span>
                  <span className="text-xs text-success">88ms</span>
                </li>
                <li className="flex items-center justify-between text-ink/60">
                  <span>模板风险检查</span>
                  <span className="text-xs text-success">1.8s</span>
                </li>
              </ul>
            </section>
          </aside>
        </>
      )}
    </>
  );
}
