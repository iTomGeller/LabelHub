'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { tokens } from '@/lib/tokens';

interface AppShellProps {
  children: React.ReactNode;
  showAgentPanel?: boolean;
  agentPanelContent?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children, showAgentPanel = false, agentPanelContent }) => {
  const pathname = usePathname();
  const { layout, colors } = tokens;

  const navItems = [
    { name: 'Dashboard', href: '/' },
    { name: '任务广场', href: '/tasks' },
    { name: '我的任务', href: '/my-tasks' },
    { name: '动态标注', href: '/annotation/dynamic' },
    { name: '审核工作台', href: '/review/complete' },
    { name: 'Agents', href: '/' },
    { name: 'Observability', href: '/' }
  ];

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden font-body" style={{ backgroundColor: colors.background }}>
      {/* 顶部任务上下文栏 高度固定 56px */}
      <header 
        className="flex items-center px-4 text-white flex-shrink-0 gap-6" 
        style={{ height: layout.topBarHeight, backgroundColor: colors.primary }}
      >
        <div className="font-bold text-xl font-heading tracking-wide flex-shrink-0">LabelHub</div>
        <div className="flex-1 text-sm font-medium">当前任务: 文本情感分类评测</div>
        <div className="space-x-4 flex items-center flex-shrink-0">
          <span className="px-3 py-1 rounded text-sm font-medium" style={{ backgroundColor: colors.accent }}>标注员</span>
          <span className="text-sm">通知 (3)</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧导航栏 固定宽度 240px */}
        <aside 
          className="text-white p-3 flex-shrink-0 overflow-y-auto" 
          style={{ width: layout.leftNavWidth, backgroundColor: colors.primary }}
        >
          <nav className="space-y-1">
            {navItems.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href} 
                  className={`block px-3 py-2.5 rounded text-sm transition-all no-underline ${isActive ? 'font-medium' : 'opacity-70 hover:opacity-100'}`}
                  style={{ color: isActive ? colors.accent : 'white' }}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* 主工作区 */}
        <main className="flex-1 overflow-auto" style={{ backgroundColor: colors.background }}>
          {children}
        </main>

        {/* 右侧 AgentPanel 默认 360px 可折叠 */}
        {showAgentPanel && agentPanelContent && (
          <aside 
            className="border-l overflow-auto flex-shrink-0" 
            style={{ width: layout.agentPanelWidth, backgroundColor: colors.surface, borderColor: colors.border }}
          >
            {agentPanelContent}
          </aside>
        )}
      </div>
    </div>
  );
};
