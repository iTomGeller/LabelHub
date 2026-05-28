'use client';

import React from 'react';
import Link from 'next/link';
import { tokens } from '@/lib/tokens';

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
      case '已完成': return tokens.colors.success;
      case '进行中': return tokens.colors.accent;
      case '待领取': return tokens.colors.primary;
      default: return tokens.colors.textLight;
    }
  };

  return (
    <Link href={`/tasks/${id}`} className="block no-underline">
      <div className="p-5 bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow" style={{ borderColor: tokens.colors.border }}>
        <h3 className="text-lg font-semibold mb-2 font-heading" style={{ color: tokens.colors.text }}>{name}</h3>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{description}</p>
        <div className="w-full h-2 bg-gray-100 rounded-full mb-2">
          <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: tokens.colors.primary }} />
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{completedItems}/{totalItems} 完成</span>
          {deadline && <span>截止: {deadline}</span>}
        </div>
        <div className="mt-2 inline-block px-2 py-1 text-xs rounded-full text-white" style={{ backgroundColor: getStatusBgColor() }}>{status}</div>
      </div>
    </Link>
  );
};
