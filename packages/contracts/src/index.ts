export type TaskStatus = "draft" | "publishing" | "paused" | "ended";

export type SchemaComponentType =
  | "shortText"
  | "longText"
  | "singleChoice"
  | "multiChoice"
  | "tagSelect"
  | "richText"
  | "fileUpload"
  | "jsonEditor"
  | "llmInteraction"
  | "showItem";

export type Severity = "low" | "medium" | "high" | "critical";

export interface ValidationRule {
  type: "required" | "minLength" | "maxLength" | "regex" | "custom";
  value?: string | number | boolean;
  message: string;
}

export interface VisibleWhen {
  fieldId: string;
  operator: "equals" | "notEquals" | "includes" | "exists";
  value?: string | number | boolean;
}

export interface SchemaComponent {
  id: string;
  type: SchemaComponentType;
  label: string;
  dataPath: string;
  required: boolean;
  props: Record<string, unknown>;
  validation: ValidationRule[];
  visibleWhen?: VisibleWhen;
  groupId?: string;
  tabId?: string;
}

export interface AnnotationSchema {
  schemaVersionId: string;
  taskId: string;
  version: number;
  title: string;
  description: string;
  components: SchemaComponent[];
  createdAt: string;
  frozen: boolean;
}

export interface RubricRule {
  ruleId: string;
  description: string;
  severity: Severity;
  appliesTo: string[];
  positiveExamples: string[];
  negativeExamples: string[];
  allowAgentAutoPass: boolean;
}

export interface RubricVersion {
  rubricVersionId: string;
  taskId: string;
  version: number;
  dimensions: string[];
  promptTemplate: string;
  rules: RubricRule[];
  frozen: boolean;
}

export interface DatasetSample {
  datasetId: string;
  taskId: string;
  sampleSize: number;
  fields: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "object" | "array" | "null";
    nullRate: number;
    example: unknown;
  }>;
  examples: DataItemView[];
}

export interface DataItemView {
  itemId: string;
  rawPayload: Record<string, unknown>;
  displayPayload: Record<string, unknown>;
  mediaRefs: string[];
  metadata: Record<string, unknown>;
}

export interface AssignmentPolicy {
  mode: "auto_claim" | "manual" | "quota";
  replicasPerItem: number;
  deadlineHours: number;
  quotaPerLabeler?: number;
}

export interface AgentPolicy {
  precheckEnabled: boolean;
  confidenceThreshold: number;
  toolWhitelist: string[];
  modelPreference: string;
  promptTemplateVersionId: string;
}

export interface TaskPackage {
  taskId: string;
  schemaVersionId: string;
  instructionVersionId: string;
  rubricVersionId: string;
  datasetId: string;
  title: string;
  status: TaskStatus;
  assignmentPolicy: AssignmentPolicy;
  agentPolicy: AgentPolicy;
  schema: AnnotationSchema;
  rubric: RubricVersion;
  sampleItems: DataItemView[];
  traceId: string;
  createdAt: string;
}

export interface SchemaRiskReport {
  taskId: string;
  schemaVersionId: string;
  riskLevel: Severity;
  findings: Array<{
    componentId?: string;
    severity: Severity;
    message: string;
    recommendation: string;
  }>;
  traceId: string;
}

export interface DatasetProfileReport {
  taskId: string;
  sampleSize: number;
  emptyFieldCount: number;
  duplicateEstimate: number;
  warnings: string[];
  traceId: string;
}

export interface PublishCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface PublishReadiness {
  taskId: string;
  ready: boolean;
  checks: PublishCheck[];
}

export interface InstructionBundle {
  instructionVersionId: string;
  taskId: string;
  content: string;
  positiveExamples: string[];
  negativeExamples: string[];
  rubricSummary: string[];
  traceId: string;
}

export interface DatasetFieldProfile {
  sourceField: string;
  inferredType: "string" | "number" | "boolean" | "object" | "array" | "null";
  nullRate: number;
  mappedPath: string;
  example: unknown;
}

export interface DatasetImportPreview {
  datasetId: string;
  taskId: string;
  acceptedFormats: string[];
  fields: DatasetFieldProfile[];
  rejectedRows: Array<{
    rowNumber: number;
    reason: string;
  }>;
  traceId: string;
}

export const SUPPORTED_COMPONENT_TYPES: SchemaComponentType[] = [
  "shortText",
  "longText",
  "singleChoice",
  "multiChoice",
  "tagSelect",
  "richText",
  "fileUpload",
  "jsonEditor",
  "llmInteraction",
  "showItem"
];

export const labelhubTokens = {
  primary: "#072C2C",
  accent: "#FF5F03",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  surface: "#EDEADE",
  text: "#111827"
} as const;

export { mockTaskPackage } from "./mockTaskPackage";
