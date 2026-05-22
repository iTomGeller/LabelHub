import type { TaskStatus } from "@labelhub/contracts";

const mockTasks = [
  {
    taskId: "task_text_cls_001",
    title: "客服对话情感分类",
    status: "publishing" as TaskStatus,
    progress: 10,
    total: 10,
    updatedAt: "2026-05-21 14:32"
  },
  {
    taskId: "task_ner_002",
    title: "电商评论实体抽取",
    status: "draft" as TaskStatus,
    progress: 6,
    total: 10,
    updatedAt: "2026-05-20 09:15"
  },
  {
    taskId: "task_qa_003",
    title: "问答对质量评估",
    status: "draft" as TaskStatus,
    progress: 2,
    total: 10,
    updatedAt: "2026-05-19 16:40"
  }
];

const statusLabels: Record<TaskStatus, string> = {
  draft: "草稿",
  publishing: "进行中",
  paused: "已暂停",
  ended: "已结束"
};

const statusColors: Record<TaskStatus, string> = {
  draft: "bg-primary/10 text-primary",
  publishing: "bg-success/10 text-success",
  paused: "bg-warning/10 text-warning",
  ended: "bg-ink/10 text-ink/60"
};

export function TaskList() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">任务列表</h1>
          <p className="mt-1 text-sm text-ink/60">管理所有标注任务，点击继续配置或新建任务。</p>
        </div>
        <a
          href="/?view=task"
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-accent/90"
        >
          + 新建任务
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockTasks.map((task) => (
          <a
            key={task.taskId}
            href="/?view=task"
            className="group rounded-2xl border border-primary/10 bg-white p-5 shadow-sm transition hover:border-accent/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-bold text-primary group-hover:text-accent">{task.title}</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColors[task.status]}`}>
                {statusLabels[task.status]}
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-ink/50">
                <span>配置进度</span>
                <span className="font-bold text-primary">{task.progress}/{task.total}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(task.progress / task.total) * 100}%` }}
                />
              </div>
            </div>

            <p className="mt-3 text-xs text-ink/40">更新于 {task.updatedAt}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
