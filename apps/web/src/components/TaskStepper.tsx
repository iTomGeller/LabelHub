"use client";

import { useState } from "react";
import { mockTaskPackage, SUPPORTED_COMPONENT_TYPES, type SchemaComponent } from "@labelhub/contracts";

const STEPS = [
  { key: "upload", label: "上传数据", num: 1 },
  { key: "template", label: "配置模板", num: 2 },
  { key: "rules", label: "质检规则", num: 3 },
  { key: "publish", label: "确认发布", num: 4 }
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function TaskStepper() {
  const [step, setStep] = useState<StepKey>("upload");
  const currentIdx = STEPS.findIndex((s) => s.key === step);

  function goNext() {
    if (currentIdx < STEPS.length - 1) setStep(STEPS[currentIdx + 1].key);
  }
  function goPrev() {
    if (currentIdx > 0) setStep(STEPS[currentIdx - 1].key);
  }
  function jumpTo(key: StepKey) {
    setStep(key);
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="rounded-2xl border border-primary/10 bg-white p-5">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => jumpTo(s.key)}
              className="flex flex-1 items-center gap-3"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  i < currentIdx
                    ? "bg-success text-white"
                    : i === currentIdx
                    ? "bg-accent text-white"
                    : "bg-surface text-ink/40"
                }`}
              >
                {i < currentIdx ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.num
                )}
              </div>
              <span
                className={`text-sm font-bold ${
                  i === currentIdx ? "text-primary" : "text-ink/40"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-px flex-1 ${i < currentIdx ? "bg-success" : "bg-primary/10"}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {step === "upload" && <StepUpload onAiGenerate={() => jumpTo("publish")} />}
      {step === "template" && <StepTemplate />}
      {step === "rules" && <StepRules />}
      {step === "publish" && <StepPublish />}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className={`rounded-xl border border-primary/20 px-5 py-2.5 text-sm font-bold ${
            currentIdx === 0 ? "cursor-not-allowed text-ink/30" : "text-primary hover:border-accent"
          }`}
        >
          上一步
        </button>
        {currentIdx < STEPS.length - 1 ? (
          <button
            onClick={goNext}
            className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-accent/90"
          >
            下一步
          </button>
        ) : (
          <button className="rounded-xl bg-success px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-success/90">
            发布任务
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Step 1: Upload Data ─── */

function StepUpload({ onAiGenerate }: { onAiGenerate: () => void }) {
  const fields = mockTaskPackage.sampleItems[0]
    ? Object.entries(mockTaskPackage.sampleItems[0].rawPayload)
    : [];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <h2 className="text-xl font-bold text-primary">上传标注数据</h2>
        <p className="mt-1 text-sm text-ink/60">拖拽文件或点击上传，系统自动检测格式和字段。</p>

        <div className="mt-5 rounded-2xl border-2 border-dashed border-primary/20 bg-surface p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <svg className="h-7 w-7 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="mt-3 text-base font-bold text-primary">拖拽文件到这里</p>
          <p className="mt-1 text-sm text-ink/50">JSON / JSONL / Excel / CSV，最大 50MB</p>
          <button className="mt-3 rounded-xl border border-primary/20 px-4 py-2 text-sm font-bold text-primary hover:border-accent">
            选择文件
          </button>
        </div>
      </div>

      {/* Auto-detected fields */}
      {fields.length > 0 && (
        <div className="rounded-2xl border border-primary/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-primary">自动检测到 {fields.length} 个字段</h3>
              <p className="mt-0.5 text-sm text-ink/50">已从样例数据中推断字段类型。</p>
            </div>
            <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
              {mockTaskPackage.sampleItems.length} 条样例
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {fields.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-xl bg-surface/70 px-4 py-2.5">
                <span className="font-mono text-sm font-bold text-primary">{key}</span>
                <span className="text-sm text-ink/50">{typeof value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI One-Click Button */}
      <div className="rounded-2xl border-2 border-accent/30 bg-accent/5 p-6 text-center">
        <h3 className="text-lg font-bold text-primary">想跳过手动配置？</h3>
        <p className="mt-1 text-sm text-ink/60">
          AI 将根据数据自动生成模板、质检规则和分配策略，你只需在最后一步确认。
        </p>
        <button
          onClick={onAiGenerate}
          className="mt-4 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-accent/90"
        >
          AI 一键配置 →
        </button>
      </div>
    </div>
  );
}

/* ─── Step 2: Template Builder ─── */

const componentLabels: Record<string, string> = {
  shortText: "单行输入",
  longText: "多行文本",
  singleChoice: "单选",
  multiChoice: "多选",
  tagSelect: "标签选择",
  richText: "富文本",
  fileUpload: "文件上传",
  jsonEditor: "JSON 编辑器",
  llmInteraction: "LLM 交互",
  showItem: "展示项"
};

function StepTemplate() {
  const components = mockTaskPackage.schema.components;
  const [selected, setSelected] = useState<SchemaComponent | null>(components[0] ?? null);
  const [showProps, setShowProps] = useState(true);

  return (
    <div className="rounded-2xl border border-primary/10 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-primary/10 px-5 py-4">
        <div>
          <h2 className="text-xl font-bold text-primary">配置标注模板</h2>
          <p className="text-sm text-ink/50">从左侧拖入组件，点击组件查看/编辑属性。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            {components.length} 个组件
          </span>
          <button
            onClick={() => setShowProps(!showProps)}
            className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-bold text-primary"
          >
            {showProps ? "隐藏属性" : "显示属性"}
          </button>
        </div>
      </div>

      <div className={`grid ${showProps ? "grid-cols-[180px_minmax(0,1fr)_260px]" : "grid-cols-[180px_minmax(0,1fr)]"}`}>
        {/* Component Library */}
        <aside className="border-r border-primary/10 bg-surface/40 p-3">
          <p className="px-2 text-xs font-bold text-ink/40">组件库</p>
          <div className="mt-2 space-y-1">
            {SUPPORTED_COMPONENT_TYPES.map((type) => (
              <button
                key={type}
                className="w-full rounded-lg border border-primary/10 bg-white px-3 py-2 text-left text-xs font-medium text-primary hover:border-accent"
              >
                {componentLabels[type]}
              </button>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <div className="min-h-[400px] bg-surface/20 p-4">
          <div className="space-y-2">
            {components.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                className={`cursor-pointer rounded-xl border bg-white px-4 py-3 transition ${
                  selected?.id === c.id ? "border-accent shadow-sm" : "border-primary/10 hover:border-accent/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                      {componentLabels[c.type]}
                    </span>
                    <span className="text-sm font-bold text-primary">{c.label}</span>
                  </div>
                  <span className="font-mono text-[10px] text-ink/40">{c.dataPath}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Property Panel */}
        {showProps && (
          <aside className="border-l border-primary/10 p-4">
            <p className="text-xs font-bold text-ink/40">属性配置</p>
            {selected ? (
              <div className="mt-3 space-y-3">
                <PropField label="名称" value={selected.label} />
                <PropField label="路径" value={selected.dataPath} mono />
                <PropField label="必填" value={selected.required ? "是" : "否"} />
                <PropField label="类型" value={componentLabels[selected.type]} />
                {selected.validation.length > 0 && (
                  <div className="rounded-lg bg-surface p-2.5">
                    <p className="text-xs font-bold text-ink/50">校验 ({selected.validation.length})</p>
                    {selected.validation.map((v, i) => (
                      <p key={i} className="mt-1 text-xs text-ink/60">{v.type}: {v.message}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink/40">点击组件查看属性</p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function PropField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold text-ink/40">{label}</p>
      <p className={`mt-0.5 text-sm font-bold text-primary ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

/* ─── Step 3: Rubric Rules ─── */

function StepRules() {
  const rules = mockTaskPackage.rubric.rules;
  const dimensions = mockTaskPackage.rubric.dimensions;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary">质检规则</h2>
            <p className="mt-1 text-sm text-ink/60">AI 已根据模板自动生成以下规则，你可以修改或新增。</p>
          </div>
          <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
            AI 已生成
          </span>
        </div>

        {/* Dimensions */}
        <div className="mt-5">
          <p className="text-sm font-bold text-primary">评分维度</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {dimensions.map((d) => (
              <span key={d} className="rounded-full border border-accent/30 bg-accent/5 px-3 py-1.5 text-sm font-bold text-accent">
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="mt-5 space-y-3">
          {rules.map((rule) => (
            <div key={rule.ruleId} className="rounded-xl border border-primary/10 bg-surface/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-primary">{rule.description}</span>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    rule.severity === "high" || rule.severity === "critical"
                      ? "bg-danger/10 text-danger"
                      : rule.severity === "medium"
                      ? "bg-warning/10 text-warning"
                      : "bg-primary/10 text-primary/60"
                  }`}>
                    {rule.severity}
                  </span>
                  {rule.allowAgentAutoPass && (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success">
                      自动通过
                    </span>
                  )}
                </div>
              </div>
              {rule.positiveExamples.length > 0 && (
                <p className="mt-2 text-xs text-success">正例：{rule.positiveExamples[0]}</p>
              )}
              {rule.negativeExamples.length > 0 && (
                <p className="mt-1 text-xs text-danger">负例：{rule.negativeExamples[0]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button className="rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm font-bold text-primary hover:border-accent">
          + 新增规则
        </button>
        <button className="rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm font-bold text-primary hover:border-accent">
          AI 重新生成
        </button>
        <button className="rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm font-bold text-primary hover:border-accent">
          导入规则模板
        </button>
      </div>
    </div>
  );
}

/* ─── Step 4: Publish ─── */

function StepPublish() {
  const tp = mockTaskPackage;
  const checks = [
    { label: "基础信息完整", ok: Boolean(tp.title) },
    { label: "标注模板 ≥10 组件", ok: tp.schema.components.length >= 10 },
    { label: "样例数据已导入", ok: tp.sampleItems.length > 0 },
    { label: "质检规则已配置", ok: tp.rubric.rules.length > 0 },
    { label: "评分维度 ≥4", ok: tp.rubric.dimensions.length >= 4 },
    { label: "提示词模板已配置", ok: Boolean(tp.rubric.promptTemplate) },
    { label: "智能预审已启用", ok: tp.agentPolicy.precheckEnabled },
    { label: "分配策略已设置", ok: tp.assignmentPolicy.mode === "auto_claim" },
    { label: "截止时间已配置", ok: tp.assignmentPolicy.deadlineHours > 0 },
    { label: "模板已冻结", ok: tp.schema.frozen }
  ];
  const passed = checks.filter((c) => c.ok).length;
  const allPassed = passed === checks.length;
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <h2 className="text-xl font-bold text-primary">确认发布</h2>
        <p className="mt-1 text-sm text-ink/60">审核以下摘要，确认无误后点击发布。</p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <SummaryItem label="任务名称" value={tp.title} />
          <SummaryItem label="标注组件" value={`${tp.schema.components.length} 类`} />
          <SummaryItem label="样例数据" value={`${tp.sampleItems.length} 条`} />
          <SummaryItem label="质检规则" value={`${tp.rubric.rules.length} 条`} />
          <SummaryItem label="评分维度" value={tp.rubric.dimensions.join("、")} />
          <SummaryItem label="分配策略" value={tp.assignmentPolicy.mode === "auto_claim" ? "自动领取" : "手动指派"} />
          <SummaryItem label="领取截止" value={`${tp.assignmentPolicy.deadlineHours} 小时`} />
          <SummaryItem label="预审阈值" value={`${Math.round(tp.agentPolicy.confidenceThreshold * 100)}%`} />
        </div>

        <button
          onClick={() => setShowJson(!showJson)}
          className="mt-4 text-xs font-bold text-accent hover:underline"
        >
          {showJson ? "收起 JSON" : "查看任务包 JSON"}
        </button>
        {showJson && (
          <pre className="mt-3 max-h-[300px] overflow-auto rounded-xl bg-primary p-4 text-xs leading-5 text-white/90">
            {JSON.stringify(tp, null, 2)}
          </pre>
        )}
      </div>

      {/* Publish Checks */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-primary">发布检查</h3>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${
            allPassed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          }`}>
            {passed}/{checks.length} 通过
          </span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 rounded-lg bg-surface/60 px-3 py-2">
              <span className={`h-2 w-2 rounded-full ${c.ok ? "bg-success" : "bg-danger"}`} />
              <span className={`text-sm ${c.ok ? "text-primary" : "text-danger font-bold"}`}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface/60 px-4 py-3">
      <p className="text-xs font-bold text-ink/40">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-primary">{value}</p>
    </div>
  );
}
