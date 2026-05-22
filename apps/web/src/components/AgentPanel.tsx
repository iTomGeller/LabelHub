import type { SchemaRiskReport } from "@labelhub/contracts";

const riskReport: SchemaRiskReport = {
  taskId: "task_text_cls_001",
  schemaVersionId: "schema_v1_text_cls",
  riskLevel: "medium",
  traceId: "trace_task_text_cls_001",
  findings: [
    {
      componentId: "reason",
      severity: "medium",
      message: "判断理由有最小长度校验，但缺少必须引用原文关键词的结构化检查。",
      recommendation: "为 reason 增加自定义校验或在 Rubric 中加入引用要求。"
    },
    {
      componentId: "llm_hint",
      severity: "low",
      message: "LLM 辅助组件已配置 Prompt，但未限制输出字段。",
      recommendation: "声明 outputPath 和可采纳字段，便于 B 记录是否采纳。"
    }
  ]
};

export function AgentPanel() {
  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Agent Panel</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-primary">任务构建建议</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          SchemaAssistAgent、RubricDraftAgent 和 DatasetProfileAgent 的输出只进入任务配置建议，不直接影响审核结论。
        </p>
      </div>

      <section className="rounded-2xl border border-primary/10 bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-primary">发布前风险</h3>
          <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-bold text-warning">medium</span>
        </div>
        <div className="mt-4 space-y-3">
          {riskReport.findings.map((finding) => (
            <article key={`${finding.componentId}-${finding.message}`} className="rounded-xl bg-white p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <span>{finding.componentId ?? "task"}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5">{finding.severity}</span>
              </div>
              <p className="mt-2 text-sm leading-5 text-ink/80">{finding.message}</p>
              <p className="mt-2 text-sm font-medium text-accent">{finding.recommendation}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/10 p-4">
        <h3 className="font-semibold text-primary">工具调用</h3>
        <ul className="mt-3 space-y-2 text-sm text-ink/75">
          <li>task.getPackage: ok / 42ms</li>
          <li>dataset.sample: ok / 88ms</li>
          <li>rubric.getVersion: ok / 35ms</li>
        </ul>
      </section>

      <div className="mt-auto grid grid-cols-3 gap-2">
        <button className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white">采纳</button>
        <button className="rounded-xl border border-primary/20 px-3 py-2 text-sm font-bold text-primary">忽略</button>
        <button className="rounded-xl border border-primary/20 px-3 py-2 text-sm font-bold text-primary">
          依据
        </button>
      </div>
    </div>
  );
}
