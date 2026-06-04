'use client';

import React from 'react';
import Link from 'next/link';

interface TaskCardProps {
  id: string;
  name: string;
  description: string;
  totalItems: number;
  completedItems: number;
  deadline?: string;
  status: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({ id, name, description, totalItems, completedItems, deadline, status }) => {
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const getStatusBgColor = () => {
    switch(status) {
      case '已完成': return 'bg-success/10 text-success';
      case '进行中': return 'bg-accent/10 text-accent';
      case '待领取': return 'bg-primary/10 text-primary';
      default: return 'bg-ink/10 text-ink/60';
    }
  };

  return (
    <Link href={`/my-tasks`} className="group rounded-2xl border border-primary/10 bg-white p-5 shadow-sm transition hover:border-accent/40 hover:shadow-md no-underline">
      <div className="flex items-start justify-between">
        <h3 className="font-bold text-primary group-hover:text-accent">{name}</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getStatusBgColor()}`}>{status}</span>
      </div>
      <p className="mt-2 text-sm text-ink/50">{description}</p>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-ink/50">
          <span>{completedItems}/{totalItems} 完成</span>
          {deadline && <span className="font-bold text-primary">{deadline}</span>}
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Link>
  );
};
