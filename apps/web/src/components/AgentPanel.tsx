'use client';

import React from 'react';
import { tokens } from '@/lib/tokens';

interface AgentSuggestion {
  id: string;
  agentName: string;
  suggestion: string;
  confidence: number;
  type: 'assignment' | 'review-assist' | 'conflict' | 'sla' | 'coaching' | string;
}

interface AgentPanelProps {
  suggestions: AgentSuggestion[];
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ suggestions }) => {
  const getTypeColor = (type: string) => {
    switch(type) {
      case 'assignment': return tokens.colors.primary;
      case 'review-assist': return tokens.colors.success;
      case 'conflict': return tokens.colors.warning;
      case 'sla': return tokens.colors.danger;
      case 'coaching': return '#8b5cf6';
      default: return tokens.colors.primary;
    }
  };

  return (
    <div className="w-full bg-gray-50 p-4 border-l h-full" style={{ borderColor: tokens.colors.border }}>
      <h3 className="font-semibold mb-3 text-sm font-heading">🤖 AI Agent 建议 (仅供参考)</h3>
      <div className="space-y-3 max-h-96 overflow-auto">
        {suggestions.map((s) => (
          <div key={s.id} className="p-3 bg-white rounded-md text-sm" style={{ borderLeft: `3px solid ${getTypeColor(s.type)}` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">{s.agentName}</span>
              <span className="text-xs text-gray-500">{Math.round(s.confidence * 100)}%</span>
            </div>
            <p className="text-gray-700">{s.suggestion}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
