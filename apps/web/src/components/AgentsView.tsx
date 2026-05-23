"use client";

import { SubTabs, SearchFilter } from "./SubTabs";
import { useState } from "react";

const TABS = [
  { key: "overview", label: "助手总览" },
  { key: "template", label: "模板生成" },
  { key: "instruct", label: "指令优化" },
  { key: "risk", label: "风险检查" },
  { key: "history", label: "调用历史", count: 12 }
];

const mockHistory = [
  { id: "call_001", agent: "模板生成助手", action: "生成标注模板草案", status: "成功", time: "2026-05-21 14:32", duration: "2.1s" },
  { id: "call_002", agent: "指令优化助手", action: "优化任务说明 v3", status: "成功", time: "2026-05-21 14:28", duration: "3.4s" },
  { id: "call_003", agent: "风险检查助手", action: "检查模板完整性", status: "警告", time: "2026-05-21 14:15", duration: "1.8s" },
  { id: "call_004", agent: "模板生成助手", action: "生成质检规则", status: "成功", time: "2026-05-21 13:55", duration: "4.2s" },
  { id: "call_005", agent: "风险检查助手", action: "数据画像分析", status: "失败", time: "2026-05-21 13:40", duration: "0.9s" }
];

export function AgentsView() {
  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-primary/10 bg-white p-5 shadow-panel">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">智能助手</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-primary">AI 辅助工作台</h1>
        <p className="mt-1 text-sm text-ink/60">聚合模板生成、指令优化、数据画像和风险检查结果。</p>
      </header>

      <SubTabs tabs={TABS} defaultTab="overview">
        {(tab) => {
          switch (tab) {
            case "overview":
              return <AgentOverview />;
            case "template":
              return <AgentAction title="模板生成助手" description="基于任务说明自动生成标注模板草案，包含组件类型和校验规则建议。" actions={["生成模板草案", "追加组件", "导出模板 JSON"]} />;
            case "instruct":
              return <AgentAction title="指令优化助手" description="分析现有任务说明文本，优化表述清晰度、消歧和正负例覆盖。" actions={["优化任务说明", "生成正例", "生成负例"]} />;
            case "risk":
              return <AgentAction title="风险检查助手" description="对标注模板和数据进行完整性、一致性和质量风险扫描。" actions={["检查模板完整性", "数据画像分析", "草拟质检规则"]} />;
            case "history":
              return <HistoryTab />;
            default:
              return null;
          }
        }}
      </SubTabs>
    </section>
  );
}

function AgentOverview() {
  const agents = [
    { name: "模板生成助手", desc: "生成标注模板草案", calls: 5, status: "就绪" },
    { name: "指令优化助手", desc: "优化任务说明文本", calls: 3, status: "就绪" },
    { name: "风险检查助手", desc: "模板与数据风险扫描", calls: 4, status: "就绪" }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {agents.map((a) => (
        <div key={a.name} className="rounded-2xl border border-primary/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-primary">{a.name}</h3>
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">{a.status}</span>
          </div>
          <p className="mt-2 text-sm text-ink/60">{a.desc}</p>
          <p className="mt-3 text-xs text-ink/40">已调用 {a.calls} 次</p>
        </div>
      ))}
    </div>
  );
}

function AgentAction({ title, description, actions }: { title: string; description: string; actions: string[] }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">{title}</h2>
      <p className="mt-1 text-sm text-ink/60">{description}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {actions.map((action) => (
          <button key={action} className="rounded-xl border border-primary/10 bg-surface px-4 py-4 text-left text-sm font-bold text-primary hover:border-accent">
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}

function HistoryTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "warning" | "fail">("all");

  const filtered = mockHistory.filter((h) => {
    if (search && !h.agent.includes(search) && !h.action.includes(search)) return false;
    if (statusFilter === "success" && h.status !== "成功") return false;
    if (statusFilter === "warning" && h.status !== "警告") return false;
    if (statusFilter === "fail" && h.status !== "失败") return false;
    return true;
  });

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primary">调用历史</h2>
          <p className="mt-1 text-sm text-ink/60">所有 Agent 调用记录，支持按状态和关键词筛选。</p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "success", "warning", "fail"] as const).map((s) => {
            const labels = { all: "全部", success: "成功", warning: "警告", fail: "失败" };
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${statusFilter === s ? "bg-primary text-white" : "bg-surface text-primary"}`}
              >
                {labels[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <SearchFilter placeholder="搜索助手名或操作..." value={search} onChange={setSearch} />
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((h) => (
          <div key={h.id} className="flex items-center justify-between rounded-xl border border-primary/10 bg-surface/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-accent/10 px-2 py-1 text-xs font-bold text-accent">{h.agent}</span>
              <span className="text-sm text-primary">{h.action}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink/40">{h.duration}</span>
              <span className="text-xs text-ink/40">{h.time}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                h.status === "成功" ? "bg-success/10 text-success" :
                h.status === "警告" ? "bg-warning/10 text-warning" :
                "bg-danger/10 text-danger"
              }`}>{h.status}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-ink/40">没有匹配的调用记录</p>}
      </div>
    </div>
  );
}
