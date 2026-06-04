export interface ExportJob {
  jobId: string
  taskId: string
  format: 'JSON' | 'JSONL' | 'CSV' | 'EXCEL'
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  includeReviewRecords: boolean
  downloadUrl?: string
  createdAt: string
}
