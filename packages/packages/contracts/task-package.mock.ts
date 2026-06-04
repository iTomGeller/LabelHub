export interface TaskPackage {
  taskId: string
  name: string
  schemaVersionId: string
  dataItems: Array<{ id: string; raw: Record<string, any> }>
  rubric: Record<string, any>
}
