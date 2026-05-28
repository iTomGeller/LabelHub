'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ReviewWorkbench } from '@/components/ReviewWorkbench';
import { AgentPanel } from '@/components/AgentPanel';
import { TraceDrawer } from '@/components/TraceDrawer';

const mockTraceEvents = [
  { eventId: 'evt-001', eventType: 'ANNOTATION_DRAFT_SAVED', timestamp: '2026-05-22T10:00:00Z', actorId: 'user-labeler-001', traceId: 'trace-123' },
  { eventId: 'evt-002', eventType: 'ANNOTATION_SUBMITTED', timestamp: '2026-05-22T10:05:00Z', actorId: 'user-labeler-001', traceId: 'trace-123' },
  { eventId: 'evt-003', eventType: 'AI_REVIEW_COMPLETED', timestamp: '2026-05-22T10:06:00Z', actorId: 'ai-preset-001', traceId: 'trace-123' },
];

const mockAgentSuggestions = [
  { id: 's1', agentName: 'ReviewAssistAgent', suggestion: '该标注与历史相似案例匹配度 0.94，建议通过', confidence: 0.94, type: 'review-assist' },
  { id: 's2', agentName: 'ReviewerCoachAgent', suggestion: '您当前审核速度低于平均，建议关注边缘案例', confidence: 0.8, type: 'coaching' },
];

const mockRubric = [
  '情感分类必须与文本实际情绪一致',
  '置信度必须大于0.5才能标记为正面/负面',
  '有明显歧义的条目必须退回重新标注'
];

export default function CompleteReviewPage() {
  const [isTraceDrawerOpen, setIsTraceDrawerOpen] = useState(false);

  const handleReviewAction = async (action: any, comment?: string) => {
    console.log('Review action:', action, comment);
  };

  const agentPanelContent = (
    <div className="p-4">
      <AgentPanel suggestions={mockAgentSuggestions} />
    </div>
  );

  return (
    <AppShell showAgentPanel agentPanelContent={agentPanelContent}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">审核工作台 - 字段级差异视图</h1>
          <button 
            onClick={() => setIsTraceDrawerOpen(true)}
            className="px-4 py-2 bg-gray-800 text-white rounded-md"
          >
            查看 Trace 追踪
          </button>
        </div>
        <ReviewWorkbench
          dataItem={{ text: '这款手机续航真的太差了，用半天就没电了。' }}
          annotationResult={{ sentiment: '负面', confidence: 0.9 }}
          aiReviewResult={{ predictedSentiment: '负面', modelConfidence: 0.88 }}
          rubric={mockRubric}
          onReviewAction={handleReviewAction}
        />
        <TraceDrawer 
          isOpen={isTraceDrawerOpen} 
          onClose={() => setIsTraceDrawerOpen(false)} 
          events={mockTraceEvents}
        />
      </div>
    </AppShell>
  );
}
