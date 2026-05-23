import type { TaskPackage } from "@labelhub/contracts";

export function TaskPackagePreview({ taskPackage }: { taskPackage: TaskPackage }) {
  const preview = {
    taskId: taskPackage.taskId,
    schemaVersionId: taskPackage.schemaVersionId,
    instructionVersionId: taskPackage.instructionVersionId,
    rubricVersionId: taskPackage.rubricVersionId,
    datasetId: taskPackage.datasetId,
    assignmentPolicy: taskPackage.assignmentPolicy,
    agentPolicy: taskPackage.agentPolicy
  };

  return (
    <section className="rounded-3xl border border-primary/10 bg-primary p-5 text-white shadow-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">任务包输出</h2>
          <p className="mt-1 text-sm text-white/70">B/C 集成只依赖这个冻结契约，不反向耦合 A 页面状态。</p>
        </div>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold">已版本化</span>
      </div>
      <pre className="mt-4 max-h-[360px] overflow-auto rounded-2xl bg-black/30 p-4 font-mono text-xs leading-5">
        {JSON.stringify(preview, null, 2)}
      </pre>
    </section>
  );
}
