import type { TaskPackage } from "./index";

export const mockTaskPackage: TaskPackage = {
  taskId: "task_text_cls_001",
  schemaVersionId: "schema_v1_text_cls",
  instructionVersionId: "instruction_v1_text_cls",
  rubricVersionId: "rubric_v1_text_cls",
  datasetId: "dataset_reviews_001",
  title: "电商评论意图分类",
  status: "draft",
  assignmentPolicy: {
    mode: "auto_claim",
    replicasPerItem: 1,
    deadlineHours: 24,
    quotaPerLabeler: 100
  },
  agentPolicy: {
    precheckEnabled: true,
    confidenceThreshold: 0.82,
    toolWhitelist: [
      "task.getPackage",
      "schema.getVersion",
      "rubric.getVersion",
      "dataset.sample",
      "dataset.profile"
    ],
    modelPreference: "mock-local",
    promptTemplateVersionId: "prompt_v1_text_cls"
  },
  schema: {
    schemaVersionId: "schema_v1_text_cls",
    taskId: "task_text_cls_001",
    version: 1,
    title: "评论意图分类标注模板",
    description: "根据原始评论选择主要意图并补充判断理由。",
    frozen: false,
    createdAt: "2026-05-21T00:00:00Z",
    components: [
      {
        id: "raw_comment",
        type: "showItem",
        label: "原始评论",
        dataPath: "$.raw.comment",
        required: false,
        props: { template: "{{raw.comment}}" },
        validation: []
      },
      {
        id: "order_id",
        type: "shortText",
        label: "订单号",
        dataPath: "$.annotation.orderId",
        required: true,
        props: { placeholder: "从原始数据中复制订单号" },
        validation: [{ type: "required", message: "请填写订单号" }]
      },
      {
        id: "intent",
        type: "singleChoice",
        label: "主要意图",
        dataPath: "$.annotation.intent",
        required: true,
        props: { options: ["咨询", "投诉", "夸赞", "售后", "无关"] },
        validation: [{ type: "required", message: "请选择主要意图" }]
      },
      {
        id: "issue_types",
        type: "multiChoice",
        label: "问题类型",
        dataPath: "$.annotation.issueTypes",
        required: true,
        props: { options: ["退款", "物流", "客服", "商品质量", "价格"], min: 1, max: 3 },
        validation: [{ type: "required", message: "至少选择一个问题类型" }]
      },
      {
        id: "sentiment_tags",
        type: "tagSelect",
        label: "情绪标签",
        dataPath: "$.annotation.sentimentTags",
        required: false,
        props: { options: ["愤怒", "焦虑", "满意", "疑惑", "中性"], max: 3 },
        validation: []
      },
      {
        id: "rich_instruction",
        type: "richText",
        label: "标注说明摘录",
        dataPath: "$.annotation.instructionNote",
        required: false,
        props: { toolbar: ["bold", "italic", "quote"] },
        validation: []
      },
      {
        id: "reason",
        type: "longText",
        label: "判断理由",
        dataPath: "$.annotation.reason",
        required: true,
        props: { placeholder: "引用评论中的关键信息说明判断依据" },
        validation: [
          { type: "required", message: "请填写判断理由" },
          { type: "minLength", value: 8, message: "判断理由至少 8 个字" }
        ]
      },
      {
        id: "evidence_upload",
        type: "fileUpload",
        label: "证据截图",
        dataPath: "$.annotation.evidenceFiles",
        required: false,
        props: { accept: ["image/png", "image/jpeg"], maxFiles: 3 },
        validation: []
      },
      {
        id: "structured_meta",
        type: "jsonEditor",
        label: "结构化补充信息",
        dataPath: "$.annotation.metadata",
        required: false,
        props: { schemaHint: "{ orderId: string, channel: string }" },
        validation: []
      },
      {
        id: "llm_hint",
        type: "llmInteraction",
        label: "LLM 辅助建议",
        dataPath: "$.assistant.intentHint",
        required: false,
        props: {
          prompt: "请判断这条评论最可能的业务意图，并给出依据。",
          outputPath: "$.assistant.intentHint",
          recordAccepted: true
        },
        validation: []
      }
    ]
  },
  rubric: {
    rubricVersionId: "rubric_v1_text_cls",
    taskId: "task_text_cls_001",
    version: 1,
    dimensions: ["相关性", "准确性", "格式合规", "安全性"],
    promptTemplate:
      "你是 LabelHub 预审 Agent。请依据任务说明、Schema 和 Rubric 对标注结果进行结构化预审。",
    frozen: false,
    rules: [
      {
        ruleId: "R1",
        description: "主要意图必须能从原始评论中直接找到依据。",
        severity: "high",
        appliesTo: ["intent", "reason"],
        positiveExamples: ["评论提到退款失败，标注为售后并说明退款上下文。"],
        negativeExamples: ["评论只表达满意，但标注为投诉。"],
        allowAgentAutoPass: true
      },
      {
        ruleId: "R2",
        description: "判断理由必须引用评论中的关键词，不能只写结论。",
        severity: "medium",
        appliesTo: ["reason"],
        positiveExamples: ["因为用户说'一直不到账'，所以归为售后。"],
        negativeExamples: ["原因写'就是售后'。"],
        allowAgentAutoPass: false
      }
    ]
  },
  sampleItems: [
    {
      itemId: "item_001",
      rawPayload: {
        comment: "退款申请三天了还不到账，客服也没人回复。",
        orderId: "ORD-10001",
        channel: "mobile-app"
      },
      displayPayload: { title: "评论 #001", body: "退款申请三天了还不到账，客服也没人回复。" },
      mediaRefs: [],
      metadata: { source: "demo", language: "zh-CN" }
    }
  ],
  traceId: "trace_task_text_cls_001",
  createdAt: "2026-05-21T00:00:00Z"
};
