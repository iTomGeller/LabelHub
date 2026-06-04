'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, UserRole, roleLabels } from '@/lib/auth';

const allNavItems = [
  { key: "list", label: "任务列表", href: "/?view=list", roles: ['OWNER'] as UserRole[], external: false },
  { key: "trace", label: "开发者 Trace", href: "/?view=trace", roles: ['OWNER'] as UserRole[], external: false },
  { key: "settings", label: "系统设置", href: "/?view=settings", roles: ['OWNER'] as UserRole[], external: false },
  { key: "grafana", label: "监控面板", href: "http://localhost:3001", roles: ['OWNER', 'REVIEWER'] as UserRole[], external: true },
  { key: "tasks", label: "任务广场", href: "/tasks", roles: ['LABELER'] as UserRole[], external: false },
  { key: "my-tasks", label: "我的任务", href: "/my-tasks", roles: ['LABELER'] as UserRole[], external: false },
  { key: "annotation", label: "动态标注", href: "/annotation/dynamic", roles: ['LABELER'] as UserRole[], external: false },
  { key: "review", label: "审核工作台", href: "/review/complete", roles: ['REVIEWER'] as UserRole[], external: false },
];

export type ViewKey = (typeof allNavItems)[number]["key"];

export function AppShell({ children, activeView }: { children: React.ReactNode; activeView?: ViewKey }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentRole = useAuthStore(s => s.role);
  const switchRole = useAuthStore(s => s.switchRole);
  const logout = useAuthStore(s => s.logout);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // 根据当前角色过滤出可见菜单项
  const visibleNavItems = allNavItems.filter(item => item.roles.includes(currentRole));

  const handleRoleSwitch = (newRole: UserRole) => {
    switchRole(newRole);
    setShowRoleDropdown(false);
    if (newRole === 'OWNER') router.push('/');
    else if (newRole === 'LABELER') router.push('/tasks');
    else if (newRole === 'REVIEWER') router.push('/review/complete');
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-surface text-ink overflow-x-hidden">
      {/* 顶部栏 */}
      <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center border-b border-primary/15 bg-white/95 px-6 backdrop-blur">
        <a href="/" className="font-display text-2xl font-bold tracking-tight text-primary shrink-0">
          LabelHub
        </a>

        {/* 角色切换器 - 一键切换 Owner/Labeler/Reviewer */}
        <div className="ml-6 relative">
          <button
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="rounded-full bg-surface px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10 transition flex items-center gap-2"
          >
            <span>{roleLabels[currentRole]} / {currentRole.toLowerCase()}</span>
            <span className="text-xs">▼</span>
          </button>
          {showRoleDropdown && (
            <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl shadow-lg border border-primary/10 p-2 min-w-48">
              <div className="text-xs text-ink/40 px-3 py-2 font-bold uppercase tracking-wider">快速切换角色</div>
              {(['OWNER', 'LABELER', 'REVIEWER'] as UserRole[]).map(r => (
                <button
                  key={r}
                  onClick={() => handleRoleSwitch(r)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                    currentRole === r ? 'bg-accent/10 text-accent' : 'hover:bg-surface'
                  }`}
                >
                  {roleLabels[r]}
                </button>
              ))}
              <div className="border-t border-primary/5 mt-2 pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-danger hover:bg-danger/5"
                >
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm">通知 (0)</span>
        </div>
      </header>

      {/* 左侧导航栏 - 动态根据角色显示不同菜单 */}
      <aside className="fixed bottom-0 left-0 top-14 w-52 bg-primary px-3 py-6 text-white overflow-y-auto">
        <nav className="space-y-1" aria-label="主导航">
          {visibleNavItems.map((item) => {
            const isActive =
              (activeView && item.key === activeView) ||
              (!item.external && (pathname === item.href || pathname.startsWith(item.href + '/')));
            const className = `block rounded-xl px-4 py-3 text-sm font-semibold transition ${
              isActive
                ? "bg-accent text-white shadow-lg"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`;
            if (item.external) {
              return (
                <a key={item.key} className={className} href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.label}
                </a>
              );
            }
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
    </div>
  );
}
