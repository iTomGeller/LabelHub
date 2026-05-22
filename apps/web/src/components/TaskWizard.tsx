import type { TaskPackage } from "@labelhub/contracts";

const steps = ["基础信息", "任务说明", "模板搭建", "数据导入", "质检规则", "发布确认"];

export function TaskWizard({ taskPackage }: { taskPackage: TaskPackage }) {
  const checks = [
    { label: "基础信息", ok: Boolean(taskPackage.title) },
    { label: "富文本说明", ok: Boolean(taskPackage.schema.description) },
    { label: "标注模板", ok: taskPackage.schema.components.length >= 10 },
    { label: "数据", ok: taskPackage.sampleItems.length > 0 },
    { label: "质检规则", ok: taskPackage.rubric.rules.length > 0 },
    { label: "提示词模板", ok: Boolean(taskPackage.rubric.promptTemplate) },
    { label: "评分维度", ok: taskPackage.rubric.dimensions.length >= 4 },
    { label: "智能预审策略", ok: taskPackage.agentPolicy.precheckEnabled },
    { label: "分配策略", ok: taskPackage.assignmentPolicy.mode === "auto_claim" },
    { label: "配额/截止时间", ok: taskPackage.assignmentPolicy.deadlineHours > 0 }
  ];
  const passedChecks = checks.filter((check) => check.ok).length;

  return (
    <section className="overflow-hidden rounded-3xl border border-primary/10 bg-white shadow-panel">
      <div className="border-b border-primary/10 bg-gradient-to-r from-white via-white to-surface px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">负责人任务配置台</p>
            <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-primary">把业务需求配置成可执行任务</h1>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              这里负责冻结任务说明、标注模板、数据样例、质检规则和智能预审策略。B/C 只消费任务包，不读取页面状态。
            </p>
          </div>

          <div className="flex min-w-[260px] flex-col gap-3 rounded-2xl border border-primary/10 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink/60">发布准备度</span>
              <span className="rounded-full bg-success/10 px-3 py-1 text-sm font-bold text-success">
                {passedChecks}/{checks.length} 通过
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-success" style={{ width: `${(passedChecks / checks.length) * 100}%` }} />
            </div>
            <button className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-accent/90">
              生成任务包
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-6 gap-2">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`rounded-2xl border px-3 py-3 ${
                index === 0 ? "border-accent bg-accent text-white" : "border-primary/10 bg-surface text-primary"
              }`}
            >
              <span className={`text-xs font-bold ${index === 0 ? "text-white/80" : "text-accent"}`}>0{index + 1}</span>
              <p className="mt-1 text-sm font-bold">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <ConfigSection
            title="任务定义"
            description="负责人先把标注目标、任务状态和说明版本确认清楚。"
            items={[
              { label: "任务名称", value: taskPackage.title },
              { label: "任务状态", value: formatStatus(taskPackage.status), tone: "success" },
              { label: "说明版本", value: taskPackage.instructionVersionId },
              { label: "追踪号", value: taskPackage.traceId, mono: true }
            ]}
          />

          <ConfigSection
            title="生产与数据"
            description="这些字段会交给 B 的任务广场、领取和标注页面使用。"
            items={[
              { label: "数据集", value: taskPackage.datasetId },
              { label: "样例数量", value: `${taskPackage.sampleItems.length} 条已接入` },
              { label: "分发策略", value: formatAssignmentMode(taskPackage.assignmentPolicy.mode) },
              { label: "领取截止", value: `${taskPackage.assignmentPolicy.deadlineHours} 小时` },
              { label: "单题副本", value: `${taskPackage.assignmentPolicy.replicasPerItem} 份` },
              { label: "单人配额", value: `${taskPackage.assignmentPolicy.quotaPerLabeler ?? 0} 条` }
            ]}
          />

          <ConfigSection
            title="标注模板与智能预审"
            description="这些资产会冻结进任务包，供标注渲染和 C 的预审 Agent 使用。"
            items={[
              { label: "标注模板", value: `${taskPackage.schema.components.length} 类组件` },
              { label: "模板版本", value: taskPackage.schemaVersionId },
              { label: "质检规则", value: `${taskPackage.rubric.rules.length} 条规则` },
              { label: "评分维度", value: taskPackage.rubric.dimensions.join(" / ") },
              { label: "预审阈值", value: `${Math.round(taskPackage.agentPolicy.confidenceThreshold * 100)}%` },
              { label: "模型偏好", value: formatModel(taskPackage.agentPolicy.modelPreference) }
            ]}
          />
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-primary/10 bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-primary">发布检查</h2>
                <p className="mt-1 text-sm text-ink/60">缺口会阻止任务进入发布态。</p>
              </div>
              <span className="rounded-full bg-success px-3 py-1 text-xs font-bold text-white">可发布</span>
            </div>

            <div className="mt-4 space-y-2">
              {checks.map((check) => (
                <div
                  key={check.label}
                  className="flex items-center justify-between rounded-xl border border-primary/10 bg-white px-3 py-2"
                >
                  <span className="text-sm font-semibold text-primary">{check.label}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                    check.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                  }`}
                  >
                    {check.ok ? "通过" : "待补充"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-primary p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">下一步</p>
            <h3 className="mt-2 text-xl font-bold">预览标注页并冻结版本</h3>
            <p className="mt-2 text-sm leading-6 text-white/70">
              确认模板渲染、字段映射和规则口径后，生成可交给 B/C 联调的任务包。
            </p>
            <div className="mt-4 grid gap-2">
              <button className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary">预览标注页</button>
              <button className="rounded-xl border border-white/30 px-4 py-2 text-sm font-bold text-white">查看任务包</button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

type ConfigItem = {
  label: string;
  value: string;
  tone?: "success";
  mono?: boolean;
};

function ConfigSection({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: ConfigItem[];
}) {
  return (
    <section className="rounded-2xl border border-primary/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">{title}</h2>
          <p className="mt-1 text-sm text-ink/60">{description}</p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={`${title}-${item.label}`} className="rounded-xl border border-primary/10 bg-surface/60 px-4 py-3">
            <dt className="text-xs font-bold tracking-wide text-ink/50">{item.label}</dt>
            <dd
              className={`mt-1 break-words text-sm font-bold ${
                item.tone === "success" ? "text-success" : "text-primary"
              } ${item.mono ? "font-mono" : ""}`}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatStatus(status: TaskPackage["status"]) {
  const labels: Record<TaskPackage["status"], string> = {
    draft: "草稿",
    publishing: "发布中",
    paused: "已暂停",
    ended: "已结束"
  };

  return labels[status];
}

function formatAssignmentMode(mode: TaskPackage["assignmentPolicy"]["mode"]) {
  const labels: Record<TaskPackage["assignmentPolicy"]["mode"], string> = {
    auto_claim: "自动领取",
    manual: "人工指派",
    quota: "配额领取"
  };

  return labels[mode];
}

function formatModel(model: string) {
  return model === "mock-local" ? "本地模拟模型" : model;
}
