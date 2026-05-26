"use client";

import { GRAFANA_AGENT_DASHBOARD_URL } from "@/lib/diagnosticLabels";

const navItems = [
  { key: "list", label: "任务列表", href: "/?view=list", external: false },
  { key: "trace", label: "开发者 Trace", href: "/?view=trace", external: false },
  { key: "settings", label: "系统设置", href: "/?view=settings", external: false },
  {
    key: "grafana",
    label: "监控面板",
    href: GRAFANA_AGENT_DASHBOARD_URL,
    external: true,
  },
] as const;

export type ViewKey = (typeof navItems)[number]["key"] | "task" | "detail";

export function AppShell({
  children,
  activeView
}: {
  children: React.ReactNode;
  activeView: ViewKey;
}) {
  return (
    <div className="min-h-screen bg-surface text-ink overflow-x-hidden">
      <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center border-b border-primary/15 bg-white/95 px-6 backdrop-blur">
        <a href="/?view=list" className="font-display text-2xl font-bold tracking-tight text-primary shrink-0">
          LabelHub
        </a>
        <div className="ml-6 rounded-full bg-surface px-3 py-1 text-sm font-medium text-primary shrink-0">
          负责人 / A 模块
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-14 w-52 bg-primary px-3 py-6 text-white overflow-y-auto">
        <nav className="space-y-1" aria-label="主导航">
          {navItems.map((item) => {
            const isActive =
              item.key === activeView ||
              (item.key === "list" && (activeView === "task" || activeView === "detail"));
            const className = `block rounded-xl px-4 py-3 text-sm font-semibold transition ${
              isActive
                ? "bg-accent text-white shadow-lg"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`;
            if (item.external) {
              return (
                <a
                  key={item.key}
                  className={className}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.label}
                </a>
              );
            }
            return (
              <a key={item.key} className={className} href={item.href}>
                {item.label}
              </a>
            );
          })}
        </nav>
      </aside>

      <main className="min-h-screen pl-52 pt-14 overflow-x-hidden">
        <section className="p-6 max-w-full">{children}</section>
      </main>
    </div>
  );
}
