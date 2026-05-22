const navItems = [
  "Dashboard",
  "Tasks",
  "Datasets",
  "SchemaBuilder",
  "Agents",
  "Observability",
  "Export"
];

export function AppShell({
  children,
  agentPanel
}: {
  children: React.ReactNode;
  agentPanel: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center border-b border-primary/15 bg-white/95 px-6 backdrop-blur">
        <div className="font-display text-2xl font-bold tracking-tight text-primary">LabelHub</div>
        <div className="ml-6 rounded-full bg-surface px-3 py-1 text-sm font-medium text-primary">
          Owner / A 模块
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm text-primary/80">
          <span>trace: trace_task_text_cls_001</span>
          <span className="rounded-full bg-accent px-3 py-1 font-semibold text-white">SchemaAssistAgent</span>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-14 w-60 bg-primary px-4 py-6 text-white">
        <nav className="space-y-2">
          {navItems.map((item) => (
            <a
              key={item}
              className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${
                item === "Tasks" ? "bg-accent text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
              href="#"
            >
              {item}
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
