'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { TaskCard } from '@/components/TaskCard';

const mockMyTasks = [
  { id: '1', name: '情感分类标注', description: '你当前进行中的标注任务', totalItems: 100, completedItems: 45, deadline: '2026-05-30', status: '进行中' },
];

const mockContribution = {
  totalAnnotations: 245,
  totalReviewHours: 12.5,
  passRate: 0.92,
  avgAnnotationTimeMs: 15200,
};

export default function MyTasksPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending-claim' | 'in-progress'>('all');

  return (
    <AppShell>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">我的工作台</h1>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{mockContribution.totalAnnotations}</div>
            <div className="text-sm text-gray-500">总标注数</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{Math.round(mockContribution.passRate * 100)}%</div>
            <div className="text-sm text-gray-500">通过率</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600">{mockContribution.totalReviewHours}h</div>
            <div className="text-sm text-gray-500">总工作时长</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600">{Math.round(mockContribution.avgAnnotationTimeMs / 1000)}s</div>
            <div className="text-sm text-gray-500">平均标注耗时</div>
          </div>
        </div>

        <div className="flex gap-3 mb-4 border-b">
          {(['all', 'pending-claim', 'in-progress'] as const).map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 ${activeTab === tab ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
            >
              {tab === 'all' ? '全部任务' : tab === 'pending-claim' ? '待领取' : '进行中'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockMyTasks.map(task => <TaskCard key={task.id} {...task} />)}
        </div>
      </div>
    </AppShell>
  );
}
