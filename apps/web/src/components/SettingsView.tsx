"use client";

import { SubTabs } from "./SubTabs";

const TABS = [
  { key: "agents", label: "AI 助手配置" },
  { key: "export", label: "导出设置" },
  { key: "traces", label: "链路追踪" }
];

export function SettingsView() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">系统设置</h1>
        <p className="mt-1 text-sm text-ink/60">AI 助手配置、导出格式和链路追踪记录。</p>
      </div>

      <SubTabs tabs={TABS} defaultTab="agents">
        {(tab) => {
          switch (tab) {
            case "agents":
              return <AgentsSettings />;
            case "export":
              return <ExportSettings />;
            case "traces":
              return <TracesSettings />;
            default:
              return null;
          }
        }}
      </SubTabs>
    </div>
  );
}

function AgentsSettings() {
  const agents = [
    { name: "模板生成助手", model: "gpt-4o", status: "就绪", calls: 5 },
    { name: "指令优化助手", model: "gpt-4o", status: "就绪", calls: 3 },
    { name: "风险检查助手", model: "gpt-4o-mini", status: "就绪", calls: 4 }
  ];

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">AI 助手</h2>
      <p className="mt-1 text-sm text-ink/60">配置各助手的模型偏好和工具权限。</p>
      <div className="mt-5 space-y-3">
        {agents.map((a) => (
          <div key={a.name} className="flex items-center justify-between rounded-xl border border-primary/10 bg-surface/50 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-primary">{a.name}</p>
              <p className="text-xs text-ink/50">模型: {a.model} · 调用 {a.calls} 次</p>
            </div>
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">{a.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportSettings() {
  const settings = [
    { label: "默认格式", value: "JSONL" },
    { label: "编码", value: "UTF-8" },
    { label: "CSV 分隔符", value: "逗号 (,)" },
    { label: "空值处理", value: "输出 null" },
    { label: "字段映射", value: "6 个映射规则" }
  ];

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">导出设置</h2>
      <p className="mt-1 text-sm text-ink/60">配置默认导出格式、编码和字段映射。</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {settings.map((s) => (
          <div key={s.label} className="rounded-xl border border-primary/10 bg-surface/50 px-4 py-3">
            <p className="text-xs font-bold text-ink/40">{s.label}</p>
            <p className="mt-0.5 text-sm font-bold text-primary">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TracesSettings() {
  const traces = [
    { id: "trace_create_001", op: "创建任务", status: "成功", dur: "120ms", time: "14:32" },
    { id: "trace_save_002", op: "保存模板", status: "成功", dur: "85ms", time: "14:30" },
    { id: "trace_import_003", op: "数据导入", status: "警告", dur: "2.4s", time: "14:28" },
    { id: "trace_publish_004", op: "发布任务包", status: "成功", dur: "340ms", time: "14:25" },
    { id: "trace_agent_005", op: "Agent 模板生成", status: "成功", dur: "3.1s", time: "14:20" },
    { id: "trace_risk_006", op: "Agent 风险检查", status: "失败", dur: "900ms", time: "14:18" }
  ];

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">链路追踪</h2>
      <p className="mt-1 text-sm text-ink/60">任务创建、模板保存、导入、发布和 Agent 调用追踪。</p>
      <div className="mt-5 space-y-2">
        {traces.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl bg-surface/50 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-ink/50">{t.id}</span>
              <span className="text-sm font-bold text-primary">{t.op}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink/40">{t.dur}</span>
              <span className="text-xs text-ink/40">{t.time}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                t.status === "成功" ? "bg-success/10 text-success" :
                t.status === "警告" ? "bg-warning/10 text-warning" :
                "bg-danger/10 text-danger"
              }`}>{t.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
