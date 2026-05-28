export enum AnnotationItemStatus {
  CREATED = 'CREATED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  AI_REVIEW_PENDING = 'AI_REVIEW_PENDING',
  AI_REVIEWED = 'AI_REVIEWED',
  MANUAL_REVIEW_PENDING = 'MANUAL_REVIEW_PENDING',
  REVIEW_PASSED = 'REVIEW_PASSED',
  REVIEW_REJECTED = 'REVIEW_REJECTED',
  ARCHIVED = 'ARCHIVED'
}

export enum WorkflowEventType {
  ITEM_ASSIGNED = 'ITEM_ASSIGNED',
  ANNOTATION_UPDATED = 'ANNOTATION_UPDATED',
  ANNOTATION_SUBMITTED = 'ANNOTATION_SUBMITTED',
  AI_REVIEW_STARTED = 'AI_REVIEW_STARTED',
  AI_REVIEW_COMPLETED = 'AI_REVIEW_COMPLETED',
  REVIEW_STARTED = 'REVIEW_STARTED',
  REVIEW_PASSED_EVENT = 'REVIEW_PASSED_EVENT',
  REVIEW_REJECTED_EVENT = 'REVIEW_REJECTED_EVENT',
  ITEM_REOPENED = 'ITEM_REOPENED'
}

export interface WorkflowEvent {
  eventId: string
  eventType: WorkflowEventType
  taskId: string
  itemId: string
  actorId: string
  actorType: 'HUMAN' | 'AGENT'
  timestamp: string
  payload: Record<string, any>
  traceId?: string
}

export interface AnnotationItem {
  id: string
  taskId: string
  dataId: string
  status: AnnotationItemStatus
  currentLabelerId?: string
  currentReviewerId?: string
  annotationResult?: Record<string, any>
  draft?: Record<string, any>
  aiReviewResult?: AIReviewResult
  reviewComment?: string
  reviewRound: number
  createdAt: string
  updatedAt: string
}

export interface AIReviewResult {
  score: number
  confidence: number
  verdict: 'PASS' | 'NEED_REVIEW' | 'REJECT'
  comments: string[]
  dimensions: Array<{ name: string; score: number; reason: string }>
}

export interface TaskAssignment {
  id: string
  taskId: string
  userId: string
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED'
  itemsAssigned: number
  itemsCompleted: number
  quota: number
  startedAt: string
}
