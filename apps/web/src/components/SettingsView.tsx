"use client";

import { useState, useEffect } from "react";
import { SubTabs } from "./SubTabs";

const TABS = [
  { key: "ai", label: "AI 服务状态" },
  { key: "export", label: "导出设置" },
  { key: "traces", label: "链路追踪" }
];

export function SettingsView() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">系统设置</h1>
        <p className="mt-1 text-sm text-ink/60">AI 服务监控、任务包导出和操作记录。</p>
      </div>

      <SubTabs tabs={TABS} defaultTab="ai">
        {(tab) => {
          switch (tab) {
            case "ai": return <AiSettings />;
            case "export": return <ExportSettings />;
            case "traces": return <TracesSettings />;
            default: return null;
          }
        }}
      </SubTabs>
    </div>
  );
}

function AiSettings() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [metrics, setMetrics] = useState<{ calls: string; latency: string } | null>(null);

  useEffect(() => {
    fetch("/agent-api/agents/metrics-summary")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setMetrics(data); })
      .catch(() => {});
  }, []);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/agent-api/agents/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTestResult({
        ok: data.status === "ok" && data.api_key_set === "yes",
        msg: data.api_key_set === "yes"
          ? `连接正常 — 模型: ${data.model}，API Key 已配置`
          : "服务在线但 API Key 未配置（联系管理员在服务端环境变量中设置）"
      });
    } catch (e) {
      setTestResult({ ok: false, msg: `连接失败: ${e instanceof Error ? e.message : "未知错误"}` });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary">DeepSeek AI 服务状态</h2>
        <p className="mt-1 text-sm text-ink/60">AI 一键生成功能由服务端 DeepSeek API 驱动，无需手动配置。</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatusCard label="服务状态" endpoint="/agent-api/agents/health" field="status" />
        <StatusCard label="API Key" endpoint="/agent-api/agents/health" field="api_key_set" />
        <StatusCard label="当前模型" endpoint="/agent-api/agents/health" field="model" />
      </div>

      {metrics && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-primary/10 bg-surface/50 px-4 py-3">
            <p className="text-xs font-bold text-ink/40">总调用次数</p>
            <p className="mt-1 text-lg font-bold text-primary">{metrics.calls}</p>
          </div>
          <div className="rounded-xl border border-primary/10 bg-surface/50 px-4 py-3">
            <p className="text-xs font-bold text-ink/40">平均延迟</p>
            <p className="mt-1 text-lg font-bold text-primary">{metrics.latency}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={handleTest} disabled={testing} className="rounded-xl border border-accent px-5 py-2.5 text-sm font-bold text-accent hover:bg-accent/5 disabled:opacity-50">
          {testing ? "测试中…" : "测试连接"}
        </button>
        <a href="/grafana/" target="_blank" rel="noopener" className="rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-bold text-primary hover:bg-surface/50">
          打开监控面板
        </a>
      </div>

      {testResult && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${testResult.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"}`}>
          {testResult.ok ? "\u2713 " : "\u2715 "}{testResult.msg}
        </div>
      )}

      <div className="rounded-xl bg-surface/50 p-4">
        <p className="text-xs font-bold text-ink/40">说明</p>
        <ul className="mt-2 space-y-1 text-xs text-ink/60">
          <li>DeepSeek API Key 通过服务端环境变量配置，前端无需操作</li>
          <li>创建任务时点击 AI 一键配置 即可自动生成标注方案</li>
          <li>详细监控数据请访问 Grafana 看板</li>
        </ul>
      </div>
    </div>
  );
}

function StatusCard({ label, endpoint, field }: { label: string; endpoint: string; field: string }) {
  const [value, setValue] = useState<string>("加载中…");
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(endpoint)
      .then((r) => { if (!r.ok) throw new Error("offline"); return r.json(); })
      .then((data) => {
        const v = data[field] || "未知";
        const display = v === "ok" ? "正常" : v === "yes" ? "已配置" : v === "no" ? "未配置" : v;
        setValue(display);
        setOk(v === "ok" || v === "yes" || (field === "model" && v.length > 0));
      })
      .catch(() => { setValue("离线"); setOk(false); });
  }, [endpoint, field]);

  return (
    <div className="rounded-xl border border-primary/10 bg-surface/50 px-4 py-3">
      <p className="text-xs font-bold text-ink/40">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {ok !== null && <span className={`h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-danger"}`} />}
        <span className="text-sm font-bold text-primary">{value}</span>
      </div>
    </div>
  );
}

function ExportSettings() {
  const [format, setFormat] = useState("json");

  function handleExport() {
    const tasks = JSON.parse(localStorage.getItem("labelhub_published_tasks") || "[]");
    const packages = tasks.map((id: string) => {
      const data = localStorage.getItem(`labelhub_task_${id}`);
      return data ? JSON.parse(data) : null;
    }).filter(Boolean);

    const content = format === "json"
      ? JSON.stringify(packages, null, 2)
      : packages.map((p: unknown) => JSON.stringify(p)).join("\n");

    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `labelhub_tasks.${format === "json" ? "json" : "jsonl"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-primary">导出设置</h2>
        <p className="mt-1 text-sm text-ink/60">导出已发布的任务包配置。</p>
      </div>

      <div>
        <label className="block text-xs font-bold text-ink/60 mb-1">导出格式</label>
        <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full rounded-xl border border-primary/15 px-4 py-2.5 text-sm focus:border-accent focus:outline-none">
          <option value="json">JSON（格式化）</option>
          <option value="jsonl">JSONL（每行一条）</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleExport} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90">导出所有任务包</button>
      </div>

      <div className="rounded-xl bg-surface/50 p-4">
        <p className="text-xs font-bold text-ink/40">导出说明</p>
        <ul className="mt-2 space-y-1 text-xs text-ink/60">
          <li>导出包含所有已发布任务的完整配置</li>
          <li>B/C 模块可直接消费导出的 JSON</li>
          <li>编码：UTF-8</li>
        </ul>
      </div>
    </div>
  );
}

function TracesSettings() {
  const [traces, setTraces] = useState<Array<{ id: string; op: string; time: string; status: string }>>([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("labelhub_traces") || "[]");
    if (stored.length > 0) {
      setTraces(stored);
    } else {
      setTraces([
        { id: "trace_init", op: "平台初始化", time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), status: "成功" },
      ]);
    }
  }, []);

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">操作记录</h2>
      <p className="mt-1 text-sm text-ink/60">任务创建、AI 生成和发布操作的追踪记录。</p>
      <div className="mt-5 space-y-2">
        {traces.length === 0 ? (
          <p className="text-center text-sm text-ink/40 py-8">暂无操作记录</p>
        ) : (
          traces.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl bg-surface/50 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-ink/50">{t.id.slice(0, 15)}</span>
                <span className="text-sm font-bold text-primary">{t.op}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink/40">{t.time}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.status === "成功" ? "bg-success/10 text-success" : t.status === "警告" ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"}`}>{t.status}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
