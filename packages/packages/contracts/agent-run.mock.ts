export interface AgentRun {
  agentRunId: string
  taskId: string
  itemId: string
  traceId: string
  agentType: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  result: Record<string, any>
  createdAt: string
}
