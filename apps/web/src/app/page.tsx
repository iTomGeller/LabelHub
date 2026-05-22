import { mockTaskPackage } from "@labelhub/contracts";
import { AgentPanel } from "@/components/AgentPanel";
import { AppShell, type ViewKey } from "@/components/AppShell";
import { DatasetImport } from "@/components/DatasetImport";
import { SchemaBuilder } from "@/components/SchemaBuilder";
import { TaskWizard } from "@/components/TaskWizard";
import { AgentsView } from "@/components/AgentsView";
import { ObservabilityView } from "@/components/ObservabilityView";
import { ExportView } from "@/components/ExportView";

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
      return <DatasetImport />;
    case "schema":
      return <SchemaBuilder components={mockTaskPackage.schema.components} />;
    case "agents":
      return <AgentsView />;
    case "observability":
      return <ObservabilityView />;
    case "export":
      return <ExportView />;
  }
}

function DashboardView() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-panel">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">数据生产总览</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-primary">A 模块当前状态</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
          高层指标和各工作区入口，不承载具体配置表单。
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

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-panel">
      <p className="text-sm font-semibold text-ink/60">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-sm text-ink/60">{hint}</p>
    </article>
  );
}
