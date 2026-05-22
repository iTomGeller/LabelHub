"use client";

import { SubTabs, SearchFilter } from "./SubTabs";
import { useState } from "react";

const TABS = [
  { key: "traces", label: "追踪列表", count: 8 },
  { key: "tools", label: "工具调用" },
  { key: "logs", label: "诊断日志" }
];

const mockTraces = [
  { traceId: "trace_create_001", operation: "创建任务", status: "成功", duration: "120ms", time: "2026-05-21 14:32:01" },
  { traceId: "trace_save_schema_002", operation: "保存模板", status: "成功", duration: "85ms", time: "2026-05-21 14:30:15" },
  { traceId: "trace_import_003", operation: "数据导入", status: "警告", duration: "2.4s", time: "2026-05-21 14:28:33" },
  { traceId: "trace_publish_004", operation: "发布任务包", status: "成功", duration: "340ms", time: "2026-05-21 14:25:10" },
  { traceId: "trace_agent_005", operation: "Agent 模板生成", status: "成功", duration: "3.1s", time: "2026-05-21 14:20:45" },
  { traceId: "trace_agent_006", operation: "Agent 风险检查", status: "失败", duration: "900ms", time: "2026-05-21 14:18:22" },
  { traceId: "trace_validate_007", operation: "模板校验", status: "成功", duration: "45ms", time: "2026-05-21 14:15:08" },
  { traceId: "trace_dataset_008", operation: "数据画像", status: "成功", duration: "1.6s", time: "2026-05-21 14:10:30" }
];

export function ObservabilityView() {
  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-primary/10 bg-white p-5 shadow-panel">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">链路观测</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-primary">追踪与诊断</h1>
        <p className="mt-1 text-sm text-ink/60">查看任务创建、模板保存、数据导入、任务发布和 Agent 调用的追踪记录。</p>
      </header>

      <SubTabs tabs={TABS} defaultTab="traces">
        {(tab) => {
          switch (tab) {
            case "traces":
              return <TracesTab />;
            case "tools":
              return <ToolsTab />;
            case "logs":
              return <LogsTab />;
            default:
              return null;
          }
        }}
      </SubTabs>
    </section>
  );
}

function TracesTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "warning" | "fail">("all");

  const filtered = mockTraces.filter((t) => {
    if (search && !t.traceId.includes(search) && !t.operation.includes(search)) return false;
    if (statusFilter === "success" && t.status !== "成功") return false;
    if (statusFilter === "warning" && t.status !== "警告") return false;
    if (statusFilter === "fail" && t.status !== "失败") return false;
    return true;
  });

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-primary">追踪列表</h2>
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
        <SearchFilter placeholder="搜索追踪号或操作名..." value={search} onChange={setSearch} />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-primary/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary text-white">
            <tr>
              <th className="px-4 py-3 font-bold">追踪号</th>
              <th className="px-4 py-3 font-bold">操作</th>
              <th className="px-4 py-3 font-bold">耗时</th>
              <th className="px-4 py-3 font-bold">时间</th>
              <th className="px-4 py-3 font-bold">状态</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.traceId} className="border-b border-primary/10 last:border-b-0">
                <td className="px-4 py-3 font-mono text-xs text-primary">{t.traceId}</td>
                <td className="px-4 py-3 font-semibold text-primary">{t.operation}</td>
                <td className="px-4 py-3 text-ink/70">{t.duration}</td>
                <td className="px-4 py-3 text-xs text-ink/50">{t.time}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    t.status === "成功" ? "bg-success/10 text-success" :
                    t.status === "警告" ? "bg-warning/10 text-warning" :
                    "bg-danger/10 text-danger"
                  }`}>{t.status}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink/40">没有匹配的追踪记录</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToolsTab() {
  const tools = [
    { name: "schema_risk_check", calls: 4, avgDuration: "1.8s", lastCall: "14:18:22" },
    { name: "instruction_refine", calls: 3, avgDuration: "3.2s", lastCall: "14:28:33" },
    { name: "dataset_profile", calls: 2, avgDuration: "1.6s", lastCall: "14:10:30" },
    { name: "template_generate", calls: 5, avgDuration: "2.5s", lastCall: "14:32:01" }
  ];

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">工具调用统计</h2>
      <p className="mt-1 text-sm text-ink/60">Agent 使用的工具及其调用频率和性能。</p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {tools.map((t) => (
          <div key={t.name} className="rounded-xl border border-primary/10 bg-surface/60 px-4 py-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-primary">{t.name}</span>
              <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">{t.calls} 次</span>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-ink/50">
              <span>平均耗时: {t.avgDuration}</span>
              <span>最近调用: {t.lastCall}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsTab() {
  const logs = [
    { level: "INFO", message: "TaskPackage 生成完成，版本 schema_v1_001", time: "14:32:01" },
    { level: "WARN", message: "数据导入跳过 3 行异常数据", time: "14:28:35" },
    { level: "ERROR", message: "Agent schema_risk_check 调用超时", time: "14:18:23" },
    { level: "INFO", message: "模板校验通过，10 组件 14 校验规则", time: "14:15:08" },
    { level: "INFO", message: "数据画像完成，样本量 1000", time: "14:10:31" }
  ];

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">诊断日志</h2>
      <p className="mt-1 text-sm text-ink/60">系统级别日志，便于排查问题。</p>

      <div className="mt-5 space-y-2">
        {logs.map((log, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-xl border border-primary/10 bg-surface/60 px-4 py-3">
            <span className={`rounded-lg px-2 py-1 text-xs font-bold ${
              log.level === "ERROR" ? "bg-danger/10 text-danger" :
              log.level === "WARN" ? "bg-warning/10 text-warning" :
              "bg-success/10 text-success"
            }`}>{log.level}</span>
            <span className="flex-1 text-sm text-primary">{log.message}</span>
            <span className="text-xs text-ink/40">{log.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
