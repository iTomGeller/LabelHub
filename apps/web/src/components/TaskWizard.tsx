import type { TaskPackage } from "@labelhub/contracts";

const steps = ["基础信息", "任务说明", "模板搭建", "数据导入", "质检规则", "发布"];

export function TaskWizard({ taskPackage }: { taskPackage: TaskPackage }) {
  const checks = [
    { label: "基础信息", ok: Boolean(taskPackage.title) },
    { label: "富文本说明", ok: Boolean(taskPackage.schema.description) },
    { label: "Schema", ok: taskPackage.schema.components.length >= 10 },
    { label: "数据", ok: taskPackage.sampleItems.length > 0 },
    { label: "Rubric", ok: taskPackage.rubric.rules.length > 0 },
    { label: "Prompt 模板", ok: Boolean(taskPackage.rubric.promptTemplate) },
    { label: "评分维度", ok: taskPackage.rubric.dimensions.length >= 4 },
    { label: "AgentPolicy", ok: taskPackage.agentPolicy.precheckEnabled },
    { label: "分配策略", ok: taskPackage.assignmentPolicy.mode === "auto_claim" },
    { label: "配额/截止时间", ok: taskPackage.assignmentPolicy.deadlineHours > 0 }
  ];

  return (
    <section className="rounded-3xl border border-primary/10 bg-white p-5 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Owner Wizard</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-primary">任务创建与发布</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">
            A 模块负责把业务需求、数据样例、Schema、Rubric 和 AgentPolicy 冻结成 TaskPackage，
            让 B 可以渲染标注页，C 可以执行预审。
          </p>
        </div>
        <button className="rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-white">生成 TaskPackage</button>
      </div>

      <div className="mt-6 grid grid-cols-6 gap-2">
        {steps.map((step, index) => (
          <div key={step} className="rounded-2xl bg-surface p-3">
            <span className="text-xs font-bold text-accent">0{index + 1}</span>
            <p className="mt-1 text-sm font-bold text-primary">{step}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[1.1fr_0.9fr] gap-5">
        <div className="rounded-2xl border border-primary/10 p-4">
          <h2 className="font-bold text-primary">任务基础配置</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="任务名称" value={taskPackage.title} />
            <Field label="任务状态" value={taskPackage.status} />
            <Field label="分发策略" value={taskPackage.assignmentPolicy.mode} />
            <Field label="截止时间" value={`${taskPackage.assignmentPolicy.deadlineHours} 小时`} />
            <Field label="置信度阈值" value={`${taskPackage.agentPolicy.confidenceThreshold}`} />
            <Field label="模型偏好" value={taskPackage.agentPolicy.modelPreference} />
          </div>
        </div>

        <div className="rounded-2xl border border-primary/10 p-4">
          <h2 className="font-bold text-primary">发布检查清单</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {checks.map((check) => (
              <div
                key={check.label}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  check.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                }`}
              >
              {check.ok ? "ok" : "!"} {check.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-primary">{label}</span>
      <input className="mt-1 w-full rounded-xl border border-primary/20 px-3 py-2 text-sm" value={value} readOnly />
    </label>
  );
}
