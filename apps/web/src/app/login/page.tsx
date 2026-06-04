'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, UserRole, roleLabels } from '@/lib/auth';

const availableRoles: { role: UserRole; desc: string; emoji: string }[] = [
  { role: 'OWNER', desc: '创建任务、配置 Schema、管理任务包', emoji: '👤' },
  { role: 'LABELER', desc: '领取标注任务、填写表单、提交标注', emoji: '✏️' },
  { role: 'REVIEWER', desc: '审核标注结果、AI 建议复核、质量把关', emoji: '👁️' },
];

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore(s => s.login);
  const [selectedRole, setSelectedRole] = useState<UserRole>('OWNER');

  const handleLogin = () => {
    login(selectedRole, 'DemoUser');
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-xl border border-primary/10">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-primary mb-2">LabelHub</h1>
          <p className="text-sm text-ink/60">AI 数据标注生产控制台</p>
        </div>

        <h2 className="font-semibold text-lg text-primary mb-4">请选择您的身份角色</h2>

        <div className="space-y-3 mb-8">
          {availableRoles.map((item) => (
            <button
              key={item.role}
              onClick={() => setSelectedRole(item.role)}
              className={`w-full p-4 rounded-xl text-left transition border-2 ${
                selectedRole === item.role
                  ? 'border-accent bg-accent/5'
                  : 'border-transparent bg-surface hover:bg-surface/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.emoji}</span>
                <div>
                  <div className="font-semibold text-primary">{roleLabels[item.role]} / {item.role}</div>
                  <div className="text-xs text-ink/50 mt-0.5">{item.desc}</div>
                </div>
                {selectedRole === item.role && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white text-xs">✓</span>
                )}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleLogin}
          className="w-full py-3.5 rounded-xl bg-accent text-white font-bold text-lg hover:bg-accent/90 transition"
        >
          进入控制台
        </button>
      </div>
    </div>
  );
}
