'use client';

import React from 'react';
import { tokens } from '@/lib/tokens';

interface TraceEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  actorId: string;
  traceId: string;
  payload?: any;
}

interface TraceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: TraceEvent[];
}

export const TraceDrawer: React.FC<TraceDrawerProps> = ({ isOpen, onClose, events }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-96 h-full bg-white shadow-xl overflow-auto">
        <div className="sticky top-0 p-4 border-b bg-white z-10">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">📜 Trace 事件追踪</h3>
            <button onClick={onClose} className="text-gray-500 text-xl">&times;</button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {events.map((evt) => (
            <div key={evt.eventId} className="p-3 bg-gray-50 rounded-md text-xs">
              <div className="font-mono font-medium text-blue-600 mb-1">{evt.eventType}</div>
              <div className="text-gray-500 mb-1">{evt.timestamp}</div>
              <div className="text-gray-400">traceId: {evt.traceId}</div>
              {evt.payload && <pre className="mt-2 text-xs overflow-auto max-h-32">{JSON.stringify(evt.payload, null, 2)}</pre>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
