'use client';

import React from 'react';
import { AppShell } from '@/components/AppShell';
import { TaskCard } from '@/components/TaskCard';
import { mockTasks } from '@/lib/mockTasks';

export default function TaskPlazaPage() {
  const publishedTasks = mockTasks.filter(t => t.status === 'publishing');

  return (
    <AppShell>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">任务广场</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publishedTasks.map(task => (
            <TaskCard
              key={task.id}
              id={task.id}
              name={task.name}
              description={task.description}
              totalItems={task.totalItems}
              completedItems={task.completedItems}
              deadline={task.deadline}
              status={task.displayStatus}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
