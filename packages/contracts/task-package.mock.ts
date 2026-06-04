export const mockTaskPackage = {
  taskId: 'task-text-cls-001',
  schemaVersion: 'v1',
  schema: {
    type: 'object',
    properties: {
      sentiment: { type: 'string', enum: ['正面', '负面', '中性'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 }
    },
    required: ['sentiment', 'confidence']
  },
  dataItems: [
    { id: 'data-001', text: '这款手机续航真的太差了' }
  ],
  rubric: ['情感分类必须与实际情绪一致']
};
