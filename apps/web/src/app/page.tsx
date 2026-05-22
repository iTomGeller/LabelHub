import { mockTaskPackage } from "@labelhub/contracts";
import { AgentPanel } from "@/components/AgentPanel";
import { AppShell, type ViewKey } from "@/components/AppShell";
import { DatasetImport } from "@/components/DatasetImport";
import { SchemaBuilder } from "@/components/SchemaBuilder";
import { TaskPackagePreview } from "@/components/TaskPackagePreview";
import { TaskWizard } from "@/components/TaskWizard";

const views: ViewKey[] = ["dashboard", "tasks", "datasets", "schema", "agents", "observability", "export"];

export default function Home({ searchParams }: { searchParams?: { view?: string } }) {
  const activeView = parseView(searchParams?.view);

  return (
    <AppShell agentPanel={<AgentPanel />} activeView={activeView}>
      {renderView(activeView)}
    </AppShell>
  );
}

function parseView(view: string | undefined): ViewKey {
  return views.includes(view as ViewKey) ? (view as ViewKey) : "tasks";
}

function renderView(activeView: ViewKey) {
  switch (activeView) {
    case "dashboard":
      return <DashboardView />;
    case "tasks":
      return <TaskWizard taskPackage={mockTaskPackage} />;
    case "datasets":
      return (
        <div className="grid grid-cols-[minmax(0,1fr)_420px] gap-6">
          <DatasetImport />
          <TaskPackagePreview taskPackage={mockTaskPackage} />
        </div>
      );
    case "schema":
      return <SchemaBuilder components={mockTaskPackage.schema.components} />;
    case "agents":
      return (
        <WorkspacePlaceholder
          title="智能助手"
          description="这里聚合模板生成、规则草拟、数据画像和风险检查结果。"
          actions={["生成模板草案", "优化任务说明", "草拟质检规则"]}
        />
      );
    case "observability":
      return (
        <WorkspacePlaceholder
          title="链路观测"
          description="这里查看任务创建、模板保存、数据导入、任务发布和 Agent 调用的追踪记录。"
          actions={["查看追踪号", "查看工具调用", "导出诊断日志"]}
        />
      );
    case "export":
      return (
        <WorkspacePlaceholder
          title="导出中心"
          description="这里为 C 的导出模块预留入口，负责人可以查看字段映射和导出历史。"
          actions={["预览字段映射", "查看导出历史", "申请导出任务"]}
        />
      );
  }
}

function DashboardView() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-panel">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">数据生产总览</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-primary">A 模块当前状态</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
          这页只放高层指标和进入各工作区的入口，不承载具体配置表单，避免负责人在首页被信息淹没。
        </p>
      </section>

      <section className="grid grid-cols-4 gap-4">
        <Metric label="标注物料" value="10" hint="覆盖飞书基础物料要求" />
        <Metric label="发布检查" value="10/10" hint="基础信息、数据、规则、策略已就绪" />
        <Metric label="样本数据" value="1,000" hint="JSONL / Excel 导入目标" />
        <Metric label="追踪覆盖" value="A 侧" hint="创建、保存、导入、发布" />
      </section>
    </div>
  );
}

function WorkspacePlaceholder({
  title,
  description,
  actions
}: {
  title: string;
  description: string;
  actions: string[];
}) {
  return (
    <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-panel">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">独立工作区</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-primary">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">{description}</p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action}
            className="rounded-2xl border border-primary/10 bg-surface px-4 py-5 text-left text-sm font-bold text-primary hover:border-accent"
          >
            {action}
          </button>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-panel">
      <p className="text-sm font-semibold text-ink/60">{label}</p>
      <p className="mt-2 font-display text-4xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-sm text-ink/60">{hint}</p>
    </article>
  );
}
