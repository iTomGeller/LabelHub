"use client";

import { useState, useEffect } from "react";

interface TaskPackageData {
  taskId: string;
  title: string;
  instruction: string;
  status: string;
  publishedAt?: string;
  schema?: { components: { id: string; type: string; label: string; dataPath: string; required: boolean; props: Record<string, unknown> }[] };
  rubric?: { dimensions: string[]; rules: { ruleId: string; description: string; severity: string; appliesTo: string[] }[] };
  assignmentPolicy?: { mode: string; replicasPerItem: number; deadlineHours: number; quotaPerLabeler: number };
  agentPolicy?: { precheckEnabled: boolean; confidenceThreshold: number };
  sampleItemCount?: number;
  sampleData?: Record<string, unknown>[];
  dagReport?: { pipelineId: string; allPassed: boolean; totalMs: number; stages: { stage: string; status: string; durationMs: number; summary: string }[] };
}

const STAGE_LABELS: Record<string, string> = {
  task_context_builder: "任务说明",
  dataset_sampler: "样例数据",
  schema_generator: "标注模板",
  rubric_generator: "质检规则",
  critic: "综合评估",
  task_package_writer: "发布准备",
};

export function TaskDetail({ taskId }: { taskId?: string }) {
  const [pkg, setPkg] = useState<TaskPackageData | null>(null);
  const [tab, setTab] = useState<"overview" | "schema" | "rubric" | "data">("overview");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    const stored = localStorage.getItem(`labelhub_task_${taskId}`);
    if (stored) {
      try { setPkg(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [taskId]);

  if (!pkg) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-ink/40">未找到该任务数据</p>
        <a href="/?view=list" className="mt-4 text-sm text-accent hover:underline">返回任务列表</a>
      </div>
    );
  }

  const components = pkg.schema?.components || [];
  const rules = pkg.rubric?.rules || [];
  const dimensions = pkg.rubric?.dimensions || [];
  const dagReport = pkg.dagReport;

  function exportPkg(fmt: "json" | "md") {
    if (!pkg) return;
    let content: string, filename: string;
    if (fmt === "json") {
      content = JSON.stringify(pkg, null, 2);
      filename = `task-package-${taskId}.json`;
    } else {
      const comps = components.map((c, i) => `${i + 1}. **${c.label}** (\`${c.type}\`) ${c.required ? "[必填]" : ""}`).join("\n");
      const rls = rules.map((r, i) => `${i + 1}. \`${r.severity}\` ${r.description}`).join("\n");
      content = `# ${pkg.title}\n\n> Task ID: \`${taskId}\` | 状态: 已发布\n\n## 任务说明\n\n${pkg.instruction}\n\n## 标注组件 (${components.length})\n\n${comps}\n\n## 质检规则 (${rules.length})\n\n${rls}\n\n## 评分维度\n\n${dimensions.join(" / ")}\n`;
      filename = `task-package-${taskId}.md`;
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <a href="/?view=list" className="flex items-center gap-1 text-sm text-ink/50 hover:text-accent transition">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          返回任务列表
        </a>
        <span className="text-ink/20">/</span>
        <span className="text-sm font-bold text-primary">{pkg.title}</span>
      </div>

      {/* Header Card */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-primary">{pkg.title}</h1>
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">已发布</span>
            </div>
            <p className="mt-2 text-sm text-ink/60 leading-relaxed max-w-2xl">{pkg.instruction}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportPkg("json")} className="rounded-lg border border-accent/30 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/5">导出 JSON</button>
            <button onClick={() => exportPkg("md")} className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface/50">导出 MD</button>
            <button onClick={() => { if (!pkg?.sampleData?.length) return; const headers = Object.keys(pkg.sampleData[0]); const rows = pkg.sampleData.map(row => headers.map(h => { const v = row[h]; const s = typeof v === "object" ? JSON.stringify(v) : String(v ?? ""); return `"${s.replace(/"/g, '""')}"`; }).join(",")); const csv = [headers.join(","), ...rows].join("\n"); const b = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `task-${taskId}-data.csv`; a.click(); }} className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface/50">导出 CSV</button>
            <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(pkg, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface/50">{copied ? "已复制" : "复制"}</button>
          </div>
        </div>
        {pkg.publishedAt && <p className="mt-3 text-xs text-ink/40">发布时间: {new Date(pkg.publishedAt).toLocaleString("zh-CN")}</p>}

        {/* Stats Row */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="标注组件" value={`${components.length} 个`} />
          <StatCard label="质检规则" value={`${rules.length} 条`} />
          <StatCard label="样例数据" value={`${pkg.sampleItemCount || pkg.sampleData?.length || 0} 条`} />
          <StatCard label="评分维度" value={`${dimensions.length} 个`} />
        </div>
      </div>

      {/* AI Audit Report */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-primary">AI 质量审核报告</h2>
            <p className="text-xs text-ink/50">发布前由 Multi-Agent Pipeline 自动生成的质量评估</p>
          </div>
          {dagReport && (
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${dagReport.allPassed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
              {dagReport.allPassed ? "全部通过" : "存在警告"}
            </span>
          )}
        </div>

        {dagReport ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-surface/40 p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${dagReport.allPassed ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                  {dagReport.stages.filter(s => s.status === "success").length}/{dagReport.stages.length}
                </span>
                <div>
                  <p className="text-sm font-bold text-primary">整体评估: {dagReport.allPassed ? "合格" : "存在需关注项"}</p>
                  <p className="text-xs text-ink/40">{dagReport.stages.filter(s => s.status === "success").length} 项通过，耗时 {(dagReport.totalMs / 1000).toFixed(1)}s</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {dagReport.stages.filter(s => s.stage !== "skill_loader").map((s, idx) => (
                <div key={s.stage} className="flex items-start gap-3 rounded-xl bg-surface/30 px-4 py-3">
                  <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${s.status === "success" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                    {s.status === "success" ? "\u2713" : "!"}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-primary">{idx + 1}. {STAGE_LABELS[s.stage] || s.stage}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${s.status === "success" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{s.status === "success" ? "通过" : "需关注"}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink/60 leading-relaxed">{s.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-surface/30 p-6 text-center">
            <p className="text-sm text-ink/40">该任务发布时未保存审核报告</p>
          </div>
        )}
      </div>

      {/* Task Package Tabs */}
      <div className="rounded-2xl border border-primary/10 bg-white overflow-hidden">
        <div className="flex border-b border-primary/5">
          {([["overview", "配置概览"], ["schema", "标注模板"], ["rubric", "质检规则"], ["data", "样例数据"]] as const).map(([k, v]) => (
            <button key={k} onClick={() => setTab(k as typeof tab)} className={`px-5 py-3 text-sm font-bold transition ${tab === k ? "text-accent border-b-2 border-accent" : "text-ink/40 hover:text-primary"}`}>{v}</button>
          ))}
        </div>
        <div className="p-5 max-h-[400px] overflow-y-auto">
          {tab === "overview" && (
            <div className="grid gap-3 md:grid-cols-2">
              <StatCard label="任务 ID" value={pkg.taskId} />
              <StatCard label="分配模式" value={pkg.assignmentPolicy?.mode === "auto_claim" ? "自动领取" : "手动指派"} />
              <StatCard label="截止时间" value={`${pkg.assignmentPolicy?.deadlineHours || 24} 小时`} />
              <StatCard label="每人配额" value={`${pkg.assignmentPolicy?.quotaPerLabeler || 50} 条`} />
              <StatCard label="AI 预审" value={pkg.agentPolicy?.precheckEnabled ? `开启 (${Math.round((pkg.agentPolicy.confidenceThreshold || 0.8) * 100)}%)` : "关闭"} />
              <StatCard label="副本数" value={`${pkg.assignmentPolicy?.replicasPerItem || 1}`} />
            </div>
          )}
          {tab === "schema" && (
            <div className="space-y-2">
              {components.length === 0 ? <p className="text-sm text-ink/40">无标注组件</p> : components.map((c, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-surface/40 px-4 py-2.5">
                  <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-black text-accent uppercase">{c.type}</span>
                  <span className="text-sm font-medium text-primary flex-1">{c.label}</span>
                  <span className="text-xs text-ink/30 font-mono">{c.dataPath}</span>
                  {c.required && <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">必填</span>}
                </div>
              ))}
            </div>
          )}
          {tab === "rubric" && (
            <div className="space-y-2">
              {rules.length === 0 ? <p className="text-sm text-ink/40">无质检规则</p> : rules.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-primary/5 px-4 py-2.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${r.severity === "critical" ? "bg-danger/10 text-danger" : r.severity === "high" ? "bg-warning/10 text-warning" : "bg-primary/5 text-primary"}`}>{r.severity}</span>
                  <span className="text-sm text-primary flex-1">{r.description}</span>
                </div>
              ))}
              {dimensions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-primary/5">
                  <p className="text-xs font-bold text-ink/40 mb-2">评分维度</p>
                  <div className="flex flex-wrap gap-2">{dimensions.map((d, i) => <span key={i} className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">{d}</span>)}</div>
                </div>
              )}
            </div>
          )}
          {tab === "data" && (
            <div>
              {(pkg.sampleData && pkg.sampleData.length > 0) ? (
                <div className="space-y-2">
                  {pkg.sampleData.slice(0, 10).map((row, i) => (
                    <div key={i} className="rounded-lg bg-surface/40 px-4 py-2.5">
                      <p className="text-xs text-ink/60 font-mono truncate">{JSON.stringify(row)}</p>
                    </div>
                  ))}
                  {pkg.sampleData.length > 10 && <p className="text-xs text-ink/40 text-center pt-2">还有 {pkg.sampleData.length - 10} 条数据未展示</p>}
                </div>
              ) : (
                <p className="text-sm text-ink/40">样例数据未包含在已发布的任务包中</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* B/C Claim Status (Mock) */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <h2 className="text-lg font-bold text-primary">领取与标注进度</h2>
        <p className="text-xs text-ink/50 mt-1">B/C 模块通过 <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-mono">GET /api/tasks/{taskId}/package</code> 获取任务包</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-surface/40 p-4 text-center">
            <p className="text-2xl font-bold text-primary">0</p>
            <p className="text-xs text-ink/40 mt-1">已领取标注员</p>
          </div>
          <div className="rounded-xl bg-surface/40 p-4 text-center">
            <p className="text-2xl font-bold text-primary">0/{pkg.sampleItemCount || 0}</p>
            <p className="text-xs text-ink/40 mt-1">已完成标注</p>
          </div>
          <div className="rounded-xl bg-surface/40 p-4 text-center">
            <p className="text-2xl font-bold text-primary">—</p>
            <p className="text-xs text-ink/40 mt-1">平均质量分</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface/60 px-4 py-3">
      <p className="text-xs font-bold text-ink/40">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-primary">{value}</p>
    </div>
  );
}
