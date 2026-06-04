export const mockExportJob = {
  id: 'export-job-001',
  taskId: 'task-001',
  format: 'JSONL',
  includeReviewRecords: true,
  status: 'COMPLETED',
  totalItems: 1200,
  createdAt: new Date().toISOString(),
  downloadUrl: '/api/exports/export-job-001/download'
};
