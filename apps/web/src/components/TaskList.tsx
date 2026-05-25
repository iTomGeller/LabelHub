"use client";

import { useState, useEffect } from "react";
import type { TaskStatus } from "@labelhub/contracts";

const STEP_NAMES = ["数据上传", "配置模板", "质检规则", "确认发布"];

type FilterKey = "all" | "draft" | "publishing" | "ended";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "draft", label: "草稿" },
  { key: "publishing", label: "已发布" },
  { key: "ended", label: "已结束" },
];

const mockTasks = [
  { taskId: "task_text_cls_001", title: "客服对话情感分类", status: "draft" as TaskStatus, currentStep: 2, totalSteps: 4, updatedAt: "2026-05-21 14:32" },
  { taskId: "task_ner_002", title: "电商评论实体抽取", status: "draft" as TaskStatus, currentStep: 4, totalSteps: 4, updatedAt: "2026-05-20 09:15" },
  { taskId: "task_qa_003", title: "问答对质量评估", status: "draft" as TaskStatus, currentStep: 1, totalSteps: 4, updatedAt: "2026-05-19 16:40" }
];

const statusLabels: Record<TaskStatus, string> = { draft: "草稿", publishing: "已发布", paused: "已暂停", ended: "已结束" };
const statusColors: Record<TaskStatus, string> = { draft: "bg-primary/10 text-primary", publishing: "bg-success/10 text-success", paused: "bg-warning/10 text-warning", ended: "bg-ink/10 text-ink/60" };

export function TaskList() {
  const [tasks, setTasks] = useState(mockTasks);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    setTasks(mockTasks.map(t => {
      const stored = localStorage.getItem(`labelhub_task_${t.taskId}`);
      if (stored) {
        try {
          const pkg = JSON.parse(stored);
          if (pkg.status === "published" || pkg.publishedAt) {
            return { ...t, status: "publishing" as TaskStatus, currentStep: 4, updatedAt: pkg.publishedAt ? new Date(pkg.publishedAt).toLocaleString("zh-CN", { hour12: false }).slice(0, 16) : t.updatedAt };
          }
        } catch { /* ignore */ }
      }
      return t;
    }));
  }, []);

  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);

  function getTaskHref(task: typeof tasks[0]) {
    if (task.status === "publishing") return `/?view=detail&taskId=${task.taskId}`;
    return `/?view=task&taskId=${task.taskId}`;
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-primary">任务列表</h1>
          <p className="mt-1 text-sm text-ink/60">管理所有标注任务，点击查看详情或继续配置。</p>
        </div>
        <a href="/?view=task" className="shrink-0 self-start rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-accent/90">+ 新建任务</a>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-white border border-primary/10 p-1">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${filter === f.key ? "bg-accent text-white shadow-sm" : "text-ink/50 hover:text-primary hover:bg-surface/60"}`}>
            {f.label}
            <span className={`ml-1.5 text-xs ${filter === f.key ? "text-white/70" : "text-ink/30"}`}>
              {f.key === "all" ? tasks.length : tasks.filter(t => t.status === f.key).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/15 bg-white p-12 text-center">
          <p className="text-sm text-ink/40">暂无{filter !== "all" ? statusLabels[filter as TaskStatus] : ""}任务</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 min-w-0">
          {filtered.map((task) => (
            <a key={task.taskId} href={getTaskHref(task)} className="group min-w-0 rounded-2xl border border-primary/10 bg-white p-5 shadow-sm transition hover:border-accent/40 hover:shadow-md">
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-primary group-hover:text-accent">{task.title}</h3>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColors[task.status]}`}>{statusLabels[task.status]}</span>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-ink/50">
                  <span>{task.status === "publishing" ? "已发布" : `步骤 ${task.currentStep}/${task.totalSteps}`}</span>
                  <span className="font-bold text-primary">{task.status === "publishing" ? "完成" : STEP_NAMES[task.currentStep - 1]}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(task.status === "publishing" ? 100 : (task.currentStep / task.totalSteps) * 100)}%` }} />
                </div>
              </div>
              <p className="mt-3 text-xs text-ink/40">更新于 {task.updatedAt}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
