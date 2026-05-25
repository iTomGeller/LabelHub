"use client";

import { useState, useEffect } from "react";
import { SubTabs } from "./SubTabs";
import { KnowledgeBasePanel } from "./KnowledgeBasePanel";

const TABS = [
  { key: "ai", label: "AI 服务状态" },
  { key: "knowledge", label: "知识库" },
  { key: "export", label: "导出设置" },
];

const GRAFANA_DASHBOARD_URL =
  "/grafana/d/labelhub-agent-rag-trace/labelhub-agent-rag-trace?orgId=1&from=now-6h&to=now";

function resolveTab(tab?: string) {
  return TABS.some((t) => t.key === tab) ? tab! : "ai";
}

export function SettingsView({ initialTab }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(() => resolveTab(initialTab));

  useEffect(() => {
    setActiveTab(resolveTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    function syncFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab) setActiveTab(resolveTab(tab));
    }
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "settings");
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }

  return (
    <div className="space-y-5 min-w-0">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">系统设置</h1>
        <p className="mt-1 text-sm text-ink/60">AI 服务监控、知识库管理、任务包导出。</p>
      </div>

      <SubTabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange}>
        {(tab) => {
          switch (tab) {
            case "ai": return <AiSettings />;
            case "knowledge": return <KnowledgeBasePanel />;
            case "export": return <ExportSettings />;
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
        <a href={GRAFANA_DASHBOARD_URL} target="_blank" rel="noopener" className="rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-bold text-primary hover:bg-surface/50">
          打开 Agent 级监控面板
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
          <li>Grafana 看板按 Agent 拆分 RAG、Skill、ToolCall、MCP 指标</li>
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

  function getTaskPackages() {
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith("labelhub_task_"));
    return allKeys.map(k => { try { return JSON.parse(localStorage.getItem(k) || ""); } catch { return null; } }).filter(Boolean);
  }

  function toCSV(packages: Record<string, unknown>[]) {
    if (packages.length === 0) return "";
    const rows = packages.map(p => ({
      taskId: p.taskId || "",
      title: p.title || "",
      status: p.status || "",
      componentCount: Array.isArray(p.schema) ? 0 : ((p.schema as Record<string, unknown>)?.components as unknown[] || []).length,
      ruleCount: ((p.rubric as Record<string, unknown>)?.rules as unknown[] || []).length,
      dimensionCount: ((p.rubric as Record<string, unknown>)?.dimensions as unknown[] || []).length,
      assignmentMode: ((p.assignmentPolicy as Record<string, unknown>)?.mode) || "",
      publishedAt: p.publishedAt || "",
    }));
    const header = Object.keys(rows[0]).join(",");
    const body = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    return header + "\n" + body;
  }

  function toMarkdown(packages: Record<string, unknown>[]) {
    return packages.map(p => {
      const schema = p.schema as Record<string, unknown> | undefined;
      const rubric = p.rubric as Record<string, unknown> | undefined;
      const components = (schema?.components as Record<string, unknown>[]) || [];
      const rules = (rubric?.rules as Record<string, unknown>[]) || [];
      const dims = (rubric?.dimensions as string[]) || [];
      return `# ${p.title || "未命名任务"}\n\n` +
        `- 任务 ID: ${p.taskId}\n- 状态: ${p.status}\n- 发布时间: ${p.publishedAt || "未发布"}\n\n` +
        `## 任务说明\n\n${p.instruction || "无"}\n\n` +
        `## 标注模板 (${components.length} 个组件)\n\n` +
        components.map((c, i) => `${i + 1}. **${c.label}** (${c.type}) — ${c.dataPath}`).join("\n") + "\n\n" +
        `## 质检规则 (${rules.length} 条)\n\n` +
        rules.map((r, i) => `${i + 1}. [${r.severity}] ${r.description}`).join("\n") + "\n\n" +
        `## 评分维度\n\n${dims.join("、")}\n`;
    }).join("\n---\n\n");
  }

  function handleExport() {
    const packages = getTaskPackages();
    if (packages.length === 0) { alert("暂无已保存的任务可导出"); return; }

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case "jsonl":
        content = packages.map(p => JSON.stringify(p)).join("\n");
        filename = "labelhub_tasks.jsonl";
        mimeType = "application/jsonl";
        break;
      case "csv":
        content = toCSV(packages);
        filename = "labelhub_tasks.csv";
        mimeType = "text/csv";
        break;
      case "markdown":
        content = toMarkdown(packages);
        filename = "labelhub_tasks.md";
        mimeType = "text/markdown";
        break;
      default:
        content = JSON.stringify(packages, null, 2);
        filename = "labelhub_tasks.json";
        mimeType = "application/json";
    }

    const blob = new Blob([content], { type: mimeType + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-primary">导出设置</h2>
        <p className="mt-1 text-sm text-ink/60">导出已发布的任务包配置，支持多种格式。</p>
      </div>

      <div>
        <label className="block text-xs font-bold text-ink/60 mb-1">导出格式</label>
        <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full rounded-xl border border-primary/15 px-4 py-2.5 text-sm focus:border-accent focus:outline-none">
          <option value="json">JSON（格式化，B/C 模块直接消费）</option>
          <option value="jsonl">JSONL（每行一条，适合批量处理）</option>
          <option value="csv">CSV（表格视图，适合 Excel 查看）</option>
          <option value="markdown">Markdown（可阅读报告，适合分享评审）</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleExport} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90">导出所有任务包</button>
      </div>

      <div className="rounded-xl bg-surface/50 p-4">
        <p className="text-xs font-bold text-ink/40">导出说明</p>
        <ul className="mt-2 space-y-1 text-xs text-ink/60">
          <li><strong>JSON</strong>: 完整 TaskPackage 结构，B/C 模块可直接消费</li>
          <li><strong>JSONL</strong>: 每行一个任务包，适合数据管线批量导入</li>
          <li><strong>CSV</strong>: 扁平化摘要（任务名/状态/组件数/规则数），用于 Excel 或 Google Sheets</li>
          <li><strong>Markdown</strong>: 人类可读报告格式，含标注模板和规则详情，适合飞书/钉钉分享</li>
          <li>编码：UTF-8 BOM-free</li>
        </ul>
      </div>
    </div>
  );
}
