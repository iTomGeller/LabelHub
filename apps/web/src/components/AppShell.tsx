const navItems = [
  { key: "dashboard", label: "数据总览", href: "/?view=dashboard" },
  { key: "tasks", label: "任务配置", href: "/?view=tasks" },
  { key: "datasets", label: "数据导入", href: "/?view=datasets" },
  { key: "schema", label: "模板搭建", href: "/?view=schema" },
  { key: "agents", label: "智能助手", href: "/?view=agents" },
  { key: "observability", label: "链路观测", href: "/?view=observability" },
  { key: "export", label: "导出中心", href: "/?view=export" }
] as const;

export type ViewKey = (typeof navItems)[number]["key"];

export function AppShell({
  children,
  agentPanel,
  activeView
}: {
  children: React.ReactNode;
  agentPanel: React.ReactNode;
  activeView: ViewKey;
}) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center border-b border-primary/15 bg-white/95 px-6 backdrop-blur">
        <div className="font-display text-2xl font-bold tracking-tight text-primary">LabelHub</div>
        <div className="ml-6 rounded-full bg-surface px-3 py-1 text-sm font-medium text-primary">
          负责人 / A 模块
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm text-primary/80">
          <span>追踪号：trace_task_text_cls_001</span>
          <span className="rounded-full bg-accent px-3 py-1 font-semibold text-white">模板生成助手</span>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-14 w-60 bg-primary px-4 py-6 text-white">
        <nav className="space-y-2" aria-label="主导航">
          {navItems.map((item) => (
            <a
              key={item.href}
              className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${
                item.key === activeView ? "bg-accent text-white shadow-lg" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <main className="grid min-h-screen grid-cols-[minmax(0,1fr)_360px] gap-0 pl-60 pt-14">
        <section className="p-6">{children}</section>
        <aside className="border-l border-primary/15 bg-white p-5">{agentPanel}</aside>
      </main>
    </div>
  );
}
