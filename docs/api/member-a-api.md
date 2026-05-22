# A 模块 API 接口文档

Base path: `/api` 和 `/agents`

## 任务配置接口

### 获取任务包

```
GET /api/tasks/{taskId}/package
```

返回完整的 TaskPackage JSON，供 B/C 模块消费。

**响应示例：**
```json
{
  "taskId": "task_text_cls_001",
  "title": "电商评论意图分类",
  "status": "draft",
  "schema": { "components": [...] },
  "rubric": { "dimensions": [...], "rules": [...] },
  "assignmentPolicy": { "mode": "auto_claim", "deadlineHours": 24 },
  "agentPolicy": { "precheckEnabled": true, "confidenceThreshold": 0.82 },
  "sampleItems": [...]
}
```

### 获取当前 Schema

```
GET /api/tasks/{taskId}/schema/current
```

返回当前 AnnotationSchema，B 据此渲染标注表单。

### 获取标注说明

```
GET /api/tasks/{taskId}/instructions
```

返回冻结的 InstructionBundle（说明、正反例、Rubric 摘要）。

### 获取下一条待标注数据

```
GET /api/tasks/{taskId}/items/next
```

返回 DataItemView（原始数据、展示数据、媒体引用、元数据）。

### 发布就绪检查

```
POST /api/tasks/{taskId}/publish-check
Content-Type: application/json
Body: TaskPackage JSON
```

运行 A 侧发布检查项（标题、Schema、Rubric、数据、策略等）。

### Schema 风险报告

```
POST /api/tasks/{taskId}/schema-risk
Content-Type: application/json
Body: TaskPackage JSON
```

返回 SchemaRiskReport。

### 数据集画像

```
POST /api/tasks/{taskId}/dataset-profile
Content-Type: application/json
Body: TaskPackage JSON
```

返回 DatasetProfileReport。

### 数据导入预览

```
POST /datasets/{taskId}/import-preview
```

返回格式检测、字段映射、拒绝行诊断。

---

## AI 生成接口

### 健康检查

```
GET /agents/health
```

**响应：**
```json
{
  "status": "ok",
  "model": "deepseek-chat",
  "api_key_set": "yes"
}
```

### AI 一键生成任务配置

```
POST /agents/generate-task-config
Content-Type: application/json
```

**请求体：**
```json
{
  "taskId": "task_001",
  "taskName": "电商评论意图分类",
  "instruction": "根据评论判断意图，引用原文关键词...",
  "sampleData": [
    {"comment": "退款三天不到账", "orderId": "ORD-001"}
  ],
  "traceId": "trace_001"
}
```

**响应体：**
```json
{
  "taskId": "task_001",
  "schemaComponents": [
    {
      "id": "raw_comment",
      "type": "showItem",
      "label": "原始评论",
      "dataPath": "$.raw.comment",
      "required": false,
      "props": {},
      "validation": []
    }
  ],
  "rubricRules": [
    {
      "ruleId": "R1",
      "description": "意图分类必须与评论内容一致",
      "severity": "critical",
      "appliesTo": ["intent"],
      "positiveExamples": ["..."],
      "negativeExamples": ["..."],
      "allowAgentAutoPass": true
    }
  ],
  "rubricDimensions": ["相关性", "准确性", "格式合规", "安全性"],
  "assignmentPolicy": {
    "mode": "auto_claim",
    "replicasPerItem": 1,
    "deadlineHours": 24,
    "quotaPerLabeler": 50
  },
  "agentPolicy": {
    "precheckEnabled": true,
    "confidenceThreshold": 0.8,
    "modelPreference": "deepseek-chat",
    "promptTemplateVersionId": "auto_v1"
  },
  "rationale": "AI 生成说明..."
}
```

---

## API 健康检查

```
GET /api/tasks/health
```

返回 `labelhub-api-ok`。

---

## Swagger UI

开发环境可访问自动生成的 API 文档：

```
http://localhost:8080/swagger-ui.html
```
