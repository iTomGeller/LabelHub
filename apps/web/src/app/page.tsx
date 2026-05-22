import { mockTaskPackage } from "@labelhub/contracts";
import { AgentPanel } from "@/components/AgentPanel";
import { AppShell } from "@/components/AppShell";
import { DatasetImport } from "@/components/DatasetImport";
import { SchemaBuilder } from "@/components/SchemaBuilder";
import { TaskPackagePreview } from "@/components/TaskPackagePreview";
import { TaskWizard } from "@/components/TaskWizard";

export default function Home() {
  return (
    <AppShell agentPanel={<AgentPanel />}>
      <div className="space-y-6">
        <section id="tasks" className="scroll-mt-20">
          <TaskWizard taskPackage={mockTaskPackage} />
        </section>
        <section id="dashboard" className="grid scroll-mt-20 grid-cols-4 gap-4">
          <Metric label="Schema 物料" value="10" hint="满足飞书基础物料要求" />
          <Metric label="发布检查" value="10/10" hint="基础信息、数据、Rubric、AgentPolicy" />
          <Metric label="样本数据" value="1,000" hint="JSONL/Excel 导入目标" />
          <Metric label="Trace 覆盖" value="A 侧" hint="创建、保存、导入、发布" />
        </section>
        <section id="schema-builder" className="scroll-mt-20">
          <SchemaBuilder components={mockTaskPackage.schema.components} />
        </section>
        <section id="datasets" className="grid scroll-mt-20 grid-cols-[1fr_420px] gap-6">
          <DatasetImport />
          <TaskPackagePreview taskPackage={mockTaskPackage} />
        </section>
      </div>
    </AppShell>
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
