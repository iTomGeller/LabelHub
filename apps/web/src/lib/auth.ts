'use client';

import { create } from 'zustand';

export type UserRole = 'OWNER' | 'LABELER' | 'REVIEWER';

interface AuthState {
  isLoggedIn: boolean;
  role: UserRole;
  username: string;
  login: (role: UserRole, username?: string) => void;
  logout: () => void;
  switchRole: (newRole: UserRole) => void;
}

const roleLabels: Record<UserRole, string> = {
  OWNER: '管理员',
  LABELER: '标注员',
  REVIEWER: '审核员',
};

const roleBadgeColors: Record<UserRole, string> = {
  OWNER: 'bg-surface text-primary',
  LABELER: 'bg-accent text-white',
  REVIEWER: 'bg-success text-white',
};

const roleRoutes: Record<UserRole, string> = {
  OWNER: '/',
  LABELER: '/tasks',
  REVIEWER: '/review/complete',
};

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  role: 'OWNER',
  username: '',

  login: (role, username = 'DemoUser') => {
    set({ isLoggedIn: true, role, username });
    localStorage.setItem('labelhub_auth', JSON.stringify({ isLoggedIn: true, role, username }));
  },

  logout: () => {
    set({ isLoggedIn: false, role: 'OWNER', username: '' });
    localStorage.removeItem('labelhub_auth');
  },

  switchRole: (newRole) => {
    set({ role: newRole });
    const saved = localStorage.getItem('labelhub_auth');
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.role = newRole;
      localStorage.setItem('labelhub_auth', JSON.stringify(parsed));
    }
  },
}));

export { roleLabels, roleBadgeColors, roleRoutes };

// 初始化时从 localStorage 恢复状态
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('labelhub_auth');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.isLoggedIn) {
        useAuthStore.setState({
          isLoggedIn: parsed.isLoggedIn,
          role: parsed.role,
          username: parsed.username || 'DemoUser',
        });
      }
    } catch { /* ignore */ }
  }
}
