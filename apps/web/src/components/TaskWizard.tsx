"use client";

import type { TaskPackage } from "@labelhub/contracts";
import { SubTabs, SearchFilter } from "./SubTabs";
import { useState } from "react";

const TABS = [
  { key: "overview", label: "总览" },
  { key: "basic", label: "基础信息" },
  { key: "data", label: "生产与数据" },
  { key: "template", label: "模板与预审" },
  { key: "checks", label: "发布检查", count: 10 }
];

export function TaskWizard({ taskPackage }: { taskPackage: TaskPackage }) {
  const checks = [
    { label: "基础信息", ok: Boolean(taskPackage.title), category: "基础" },
    { label: "富文本说明", ok: Boolean(taskPackage.schema.description), category: "基础" },
    { label: "标注模板", ok: taskPackage.schema.components.length >= 10, category: "模板" },
    { label: "数据", ok: taskPackage.sampleItems.length > 0, category: "数据" },
    { label: "质检规则", ok: taskPackage.rubric.rules.length > 0, category: "规则" },
    { label: "提示词模板", ok: Boolean(taskPackage.rubric.promptTemplate), category: "规则" },
    { label: "评分维度", ok: taskPackage.rubric.dimensions.length >= 4, category: "规则" },
    { label: "智能预审策略", ok: taskPackage.agentPolicy.precheckEnabled, category: "策略" },
    { label: "分配策略", ok: taskPackage.assignmentPolicy.mode === "auto_claim", category: "策略" },
    { label: "配额/截止时间", ok: taskPackage.assignmentPolicy.deadlineHours > 0, category: "策略" }
  ];
  const passedChecks = checks.filter((c) => c.ok).length;

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-white p-5 shadow-panel">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">负责人任务配置台</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-primary">
            {taskPackage.title || "新建任务"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-ink/60">发布准备度</p>
            <p className="text-lg font-bold text-success">{passedChecks}/{checks.length}</p>
          </div>
          <div className="h-10 w-px bg-primary/10" />
          <button className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-accent/90">
            生成任务包
          </button>
        </div>
      </header>

      <SubTabs tabs={TABS} defaultTab="overview">
        {(tab) => {
          switch (tab) {
            case "overview":
              return <OverviewTab taskPackage={taskPackage} checks={checks} passedChecks={passedChecks} />;
            case "basic":
              return <BasicInfoTab taskPackage={taskPackage} />;
            case "data":
              return <DataProductionTab taskPackage={taskPackage} />;
            case "template":
              return <TemplateTab taskPackage={taskPackage} />;
            case "checks":
              return <ChecksTab checks={checks} />;
            default:
              return null;
          }
        }}
      </SubTabs>
    </section>
  );
}

type Check = { label: string; ok: boolean; category: string };

function OverviewTab({
  taskPackage,
  checks,
  passedChecks
}: {
  taskPackage: TaskPackage;
  checks: Check[];
  passedChecks: number;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <SummaryCard label="任务名称" value={taskPackage.title} />
        <SummaryCard label="状态" value={formatStatus(taskPackage.status)} tone="success" />
        <SummaryCard label="标注模板组件" value={`${taskPackage.schema.components.length} 类`} />
        <SummaryCard label="样例数据" value={`${taskPackage.sampleItems.length} 条`} />
        <SummaryCard label="质检规则" value={`${taskPackage.rubric.rules.length} 条`} />
        <SummaryCard label="分发策略" value={formatAssignmentMode(taskPackage.assignmentPolicy.mode)} />
      </div>
      <aside className="space-y-4">
        <div className="rounded-2xl border border-primary/10 bg-white p-5">
          <h3 className="font-bold text-primary">快速发布检查</h3>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-success" style={{ width: `${(passedChecks / checks.length) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink/60">{passedChecks}/{checks.length} 项通过</p>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-primary p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">下一步</p>
          <h3 className="mt-2 text-lg font-bold">预览标注页并冻结版本</h3>
          <p className="mt-2 text-sm leading-6 text-white/70">
            确认模板渲染和规则后，生成可交给 B/C 的任务包。
          </p>
          <button className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary">预览标注页</button>
        </div>
      </aside>
    </div>
  );
}

function BasicInfoTab({ taskPackage }: { taskPackage: TaskPackage }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">基础信息</h2>
      <p className="mt-1 text-sm text-ink/60">任务标识、追踪号与说明版本。</p>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="任务名称" value={taskPackage.title} />
        <Field label="任务 ID" value={taskPackage.taskId} mono />
        <Field label="任务状态" value={formatStatus(taskPackage.status)} tone="success" />
        <Field label="说明版本" value={taskPackage.instructionVersionId} />
        <Field label="追踪号" value={taskPackage.traceId} mono />
        <Field label="创建时间" value={taskPackage.createdAt} />
      </dl>
    </div>
  );
}

function DataProductionTab({ taskPackage }: { taskPackage: TaskPackage }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">生产与数据</h2>
      <p className="mt-1 text-sm text-ink/60">数据集、分发策略和配额配置。这些字段会交给 B 的标注页面使用。</p>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="数据集 ID" value={taskPackage.datasetId} mono />
        <Field label="样例数量" value={`${taskPackage.sampleItems.length} 条已接入`} />
        <Field label="分发策略" value={formatAssignmentMode(taskPackage.assignmentPolicy.mode)} />
        <Field label="领取截止" value={`${taskPackage.assignmentPolicy.deadlineHours} 小时`} />
        <Field label="单题副本" value={`${taskPackage.assignmentPolicy.replicasPerItem} 份`} />
        <Field label="单人配额" value={`${taskPackage.assignmentPolicy.quotaPerLabeler ?? 0} 条`} />
      </dl>
    </div>
  );
}

function TemplateTab({ taskPackage }: { taskPackage: TaskPackage }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">标注模板与智能预审</h2>
      <p className="mt-1 text-sm text-ink/60">冻结进任务包的资产，供标注渲染和 C 的预审 Agent 使用。</p>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="标注模板" value={`${taskPackage.schema.components.length} 类组件`} />
        <Field label="模板版本" value={taskPackage.schemaVersionId} />
        <Field label="质检规则" value={`${taskPackage.rubric.rules.length} 条规则`} />
        <Field label="评分维度" value={taskPackage.rubric.dimensions.join(" / ")} />
        <Field label="预审阈值" value={`${Math.round(taskPackage.agentPolicy.confidenceThreshold * 100)}%`} />
        <Field label="模型偏好" value={formatModel(taskPackage.agentPolicy.modelPreference)} />
        <Field label="提示词模板版本" value={taskPackage.agentPolicy.promptTemplateVersionId} mono />
        <Field label="预审开关" value={taskPackage.agentPolicy.precheckEnabled ? "已启用" : "未启用"} tone="success" />
      </dl>
    </div>
  );
}

function ChecksTab({ checks }: { checks: Check[] }) {
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pass" | "fail">("all");

  const filtered = checks.filter((c) => {
    if (filter && !c.label.includes(filter) && !c.category.includes(filter)) return false;
    if (statusFilter === "pass" && !c.ok) return false;
    if (statusFilter === "fail" && c.ok) return false;
    return true;
  });

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primary">发布检查清单</h2>
          <p className="mt-1 text-sm text-ink/60">检查项必须全部通过才能进入发布态。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${statusFilter === "all" ? "bg-primary text-white" : "bg-surface text-primary"}`}
          >
            全部
          </button>
          <button
            onClick={() => setStatusFilter("pass")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${statusFilter === "pass" ? "bg-success text-white" : "bg-surface text-primary"}`}
          >
            已通过
          </button>
          <button
            onClick={() => setStatusFilter("fail")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${statusFilter === "fail" ? "bg-danger text-white" : "bg-surface text-primary"}`}
          >
            待补充
          </button>
        </div>
      </div>

      <div className="mt-4">
        <SearchFilter placeholder="搜索检查项名称或分类..." value={filter} onChange={setFilter} />
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((check) => (
          <div
            key={check.label}
            className="flex items-center justify-between rounded-xl border border-primary/10 bg-surface/60 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary/70">
                {check.category}
              </span>
              <span className="text-sm font-semibold text-primary">{check.label}</span>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                check.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
              }`}
            >
              {check.ok ? "通过" : "待补充"}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">没有匹配的检查项</p>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-primary/10 bg-white px-4 py-3">
      <span className="text-sm font-semibold text-ink/60">{label}</span>
      <span className={`text-sm font-bold ${tone === "success" ? "text-success" : "text-primary"}`}>{value}</span>
    </div>
  );
}

function Field({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: "success" }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-surface/60 px-4 py-3">
      <dt className="text-xs font-bold tracking-wide text-ink/50">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-bold ${tone === "success" ? "text-success" : "text-primary"} ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function formatStatus(status: TaskPackage["status"]) {
  const labels: Record<TaskPackage["status"], string> = { draft: "草稿", publishing: "发布中", paused: "已暂停", ended: "已结束" };
  return labels[status];
}

function formatAssignmentMode(mode: TaskPackage["assignmentPolicy"]["mode"]) {
  const labels: Record<TaskPackage["assignmentPolicy"]["mode"], string> = { auto_claim: "自动领取", manual: "人工指派", quota: "配额领取" };
  return labels[mode];
}

function formatModel(model: string) {
  return model === "mock-local" ? "本地模拟模型" : model;
}
