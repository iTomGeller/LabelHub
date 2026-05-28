'use client';

import React from 'react';
import { AppShell } from '@/components/AppShell';
import { TaskCard } from '@/components/TaskCard';

const mockTasks = [
  { id: '1', name: '情感分类标注', description: '对用户评论进行正面/负面情感标注', totalItems: 100, completedItems: 45, deadline: '2026-05-30', status: '进行中' },
  { id: '2', name: '实体识别', description: '抽取文本中的人物、地点、组织机构实体', totalItems: 200, completedItems: 120, deadline: '2026-06-15', status: '待领取' },
  { id: '3', name: '图片语义分割', description: '对自动驾驶场景图片进行像素级分割标注', totalItems: 50, completedItems: 50, deadline: '2026-05-20', status: '已完成' },
];

export default function TaskPlazaPage() {
  return (
    <AppShell>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">任务广场</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockTasks.map(task => <TaskCard key={task.id} {...task} />)}
        </div>
      </div>
    </AppShell>
  );
}
