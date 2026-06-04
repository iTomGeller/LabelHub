'use client';

import React, { useState } from 'react';
import { tokens } from '@/lib/tokens';

interface ReviewWorkbenchProps {
  dataItem: any;
  annotationResult: any;
  aiReviewResult?: any;
  rubric?: string[];
  onReviewAction: (action: 'pass' | 'reject' | 'modify-pass' | 'arbitrate', comment?: string) => Promise<void>;
}

export const ReviewWorkbench: React.FC<ReviewWorkbenchProps> = ({
  dataItem,
  annotationResult,
  aiReviewResult,
  rubric,
  onReviewAction
}) => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">原始数据</h3>
          <pre className="text-sm overflow-auto max-h-64">{JSON.stringify(dataItem, null, 2)}</pre>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg" style={{ borderLeft: `4px solid ${tokens.colorPrimary}` }}>
          <h3 className="font-semibold mb-2">标注结果</h3>
          <pre className="text-sm overflow-auto max-h-64">{JSON.stringify(annotationResult, null, 2)}</pre>
        </div>
        {aiReviewResult && (
          <div className="p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold mb-2">AI 预审结果</h3>
            <pre className="text-sm overflow-auto max-h-64">{JSON.stringify(aiReviewResult, null, 2)}</pre>
          </div>
        )}
      </div>
      <div className="space-y-4">
        {rubric && (
          <div className="p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold mb-2">审核标准 Rubric</h3>
            <ul className="list-disc pl-5 space-y-1">
              {rubric.map((r, i) => <li key={i} className="text-sm">{r}</li>)}
            </ul>
          </div>
        )}
        <div className="p-4 bg-white border rounded-lg space-y-3">
          <h3 className="font-semibold">审核动作</h3>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => { setSelectedAction('pass'); onReviewAction('pass', undefined); }}
              className="p-3 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              通过
            </button>
            <button 
              onClick={() => setSelectedAction('reject')}
              className="p-3 bg-red-500 text-white rounded-md hover:bg-red-600"
            >
              退回
            </button>
            <button 
              onClick={() => { setSelectedAction('modify-pass'); onReviewAction('modify-pass', undefined); }}
              className="p-3 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              修改后通过
            </button>
            <button 
              onClick={() => { setSelectedAction('arbitrate'); onReviewAction('arbitrate', undefined); }}
              className="p-3 bg-purple-500 text-white rounded-md hover:bg-purple-600"
            >
              仲裁
            </button>
          </div>
          {selectedAction === 'reject' && (
            <>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="请输入退回原因..."
                className="w-full p-2 border rounded-md"
                rows={3}
              />
              <button
                onClick={() => { onReviewAction('reject', comment); }}
                className="w-full p-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                确认退回
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
