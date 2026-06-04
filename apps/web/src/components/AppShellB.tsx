'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AppShellBProps {
  children: React.ReactNode;
  showAgentPanel?: boolean;
  agentPanelContent?: React.ReactNode;
}

const navItems = [
  { key: "tasks", label: "任务广场", href: "/tasks" },
  { key: "my-tasks", label: "我的任务", href: "/my-tasks" },
  { key: "annotation", label: "动态标注", href: "/annotation/dynamic" },
  { key: "review", label: "审核工作台", href: "/review/complete" },
] as const;

export function AppShellB({ children, showAgentPanel, agentPanelContent }: AppShellBProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-surface text-ink overflow-x-hidden">
      {/* 顶部栏 - 和A完全一样的白色背景 */}
      <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center border-b border-primary/15 bg-white/95 px-6 backdrop-blur">
        <a href="/tasks" className="font-display text-2xl font-bold tracking-tight text-primary shrink-0">
          LabelHub
        </a>
        <div className="ml-6 rounded-full bg-surface px-3 py-1 text-sm font-medium text-primary shrink-0">
          标注员 / B 模块
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="px-3 py-1 rounded text-sm font-medium bg-accent text-white">标注员</span>
          <span className="text-sm">通知 (3)</span>
        </div>
      </header>

      {/* 左侧导航栏 - 和A完全一样的宽度52(208px)，选中项背景橙色高亮 */}
      <aside className="fixed bottom-0 left-0 top-14 w-52 bg-primary px-3 py-6 text-white overflow-y-auto">
        <nav className="space-y-1" aria-label="标注员导航">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const className = `block rounded-xl px-4 py-3 text-sm font-semibold transition ${
              isActive
                ? "bg-accent text-white shadow-lg"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`;
            return (
              <Link key={item.key} className={className} href={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 主工作区 */}
      <main className="min-h-screen pl-52 pt-14 overflow-x-hidden">
        <section className="p-6 max-w-full">{children}</section>
      </main>

      {/* 右侧可展开 AgentPanel（可选） */}
      {showAgentPanel && agentPanelContent && (
        <aside className="fixed right-0 bottom-0 top-14 w-96 border-l border-primary/15 bg-white overflow-y-auto">
          {agentPanelContent}
        </aside>
      )}
    </div>
  );
}
