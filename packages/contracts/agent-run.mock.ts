export const mockAgentRun = {
  id: 'agent-run-001',
  taskId: 'task-001',
  itemId: 'item-001',
  agentType: 'REVIEW_ASSIST',
  status: 'COMPLETED',
  traceId: 'trace-abc123',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  result: {
    verdict: 'PASS',
    score: 0.92,
    confidence: 0.94
  }
};
