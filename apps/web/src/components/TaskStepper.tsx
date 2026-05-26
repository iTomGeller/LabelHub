"use client";

import { useState, useCallback, useEffect } from "react";

const STEPS = [
  { key: "upload", label: "上传数据", num: 1 },
  { key: "template", label: "配置模板", num: 2 },
  { key: "rules", label: "质检规则", num: 3 },
  { key: "publish", label: "确认发布", num: 4 }
] as const;

type StepKey = (typeof STEPS)[number]["key"];

interface SchemaComponent {
  id: string;
  type: string;
  label: string;
  dataPath: string;
  required: boolean;
  props: Record<string, unknown>;
  validation: Array<{ type: string; value?: unknown; message: string }>;
}

interface RubricRule {
  ruleId: string;
  description: string;
  severity: string;
  appliesTo: string[];
  positiveExamples: string[];
  negativeExamples: string[];
  allowAgentAutoPass: boolean;
}

interface TaskConfig {
  taskId: string;
  taskName: string;
  instruction: string;
  sampleData: Record<string, unknown>[];
  schemaComponents: SchemaComponent[];
  rubricRules: RubricRule[];
  rubricDimensions: string[];
  assignmentPolicy: { mode: string; replicasPerItem: number; deadlineHours: number; quotaPerLabeler: number };
  agentPolicy: { precheckEnabled: boolean; confidenceThreshold: number; modelPreference: string; promptTemplateVersionId: string };
  rationale: string;
}

const TASK_CONFIGS: Record<string, TaskConfig> = {
  task_text_cls_001: {
    taskId: "task_text_cls_001",
    taskName: "客服对话情感分类",
    instruction: "根据客服对话内容判断用户情感倾向（正面/负面/中性），标注触发情绪的关键句并给出理由。",
    sampleData: [
      { dialogue: "你们什么破售后！等了三天没人理！", sessionId: "CS-20001", agent: "小王" },
      { dialogue: "谢谢客服帮我解决了，态度很好", sessionId: "CS-20002", agent: "小李" },
      { dialogue: "请问退货地址是哪里？", sessionId: "CS-20003", agent: "小张" },
      { dialogue: "物流信息一直不更新是怎么回事", sessionId: "CS-20004", agent: "小王" },
      { dialogue: "非常满意这次的处理速度！五星好评", sessionId: "CS-20005", agent: "小李" },
    ],
    schemaComponents: [
      { id: "raw_dialogue", type: "showItem", label: "客服对话", dataPath: "$.raw.dialogue", required: false, props: { template: "{{raw.dialogue}}" }, validation: [] },
      { id: "sentiment", type: "singleChoice", label: "情感倾向", dataPath: "$.annotation.sentiment", required: true, props: { options: ["正面", "负面", "中性", "混合"] }, validation: [{ type: "required", message: "请选择情感倾向" }] },
      { id: "trigger_sentence", type: "shortText", label: "触发关键句", dataPath: "$.annotation.trigger", required: true, props: { placeholder: "引用对话中引发情绪的句子" }, validation: [{ type: "required", message: "请填写触发句" }] },
      { id: "emotion_tags", type: "multiChoice", label: "情绪类型", dataPath: "$.annotation.emotions", required: true, props: { options: ["愤怒", "焦虑", "满意", "感激", "困惑", "无奈"], min: 1, max: 3 }, validation: [{ type: "required", message: "至少选一个" }] },
      { id: "reason", type: "longText", label: "判断理由", dataPath: "$.annotation.reason", required: true, props: { placeholder: "说明为何判定该情感" }, validation: [{ type: "required", message: "请填写理由" }, { type: "minLength", value: 8, message: "至少 8 字" }] },
    ],
    rubricRules: [
      { ruleId: "R1", description: "情感标注须与对话语气一致，不得臆测", severity: "high", appliesTo: ["sentiment", "reason"], positiveExamples: ["对话有'破售后'等愤怒用语标为负面"], negativeExamples: ["询问退货地址标为负面"], allowAgentAutoPass: true },
      { ruleId: "R2", description: "触发关键句必须是原文直接引用", severity: "medium", appliesTo: ["trigger_sentence"], positiveExamples: ["直接引用原文句子"], negativeExamples: ["自己编写总结"], allowAgentAutoPass: false },
      { ruleId: "R3", description: "混合情感须同时给出正负面依据", severity: "medium", appliesTo: ["reason"], positiveExamples: ["既有不满也有感谢，分别引用"], negativeExamples: ["标为混合但只说一面"], allowAgentAutoPass: true },
    ],
    rubricDimensions: ["情感准确性", "关键句引用", "理由充分性", "一致性"],
    assignmentPolicy: { mode: "auto_claim", replicasPerItem: 2, deadlineHours: 12, quotaPerLabeler: 80 },
    agentPolicy: { precheckEnabled: true, confidenceThreshold: 0.85, modelPreference: "deepseek-chat", promptTemplateVersionId: "sentiment_v1" },
    rationale: "客服对话情感分类任务，侧重情绪识别和关键句定位，双人标注保证质量。",
  },
  task_ner_002: {
    taskId: "task_ner_002",
    taskName: "电商评论实体抽取",
    instruction: "从电商评论中抽取商品名称、品牌、属性描述、问题类型等命名实体，标注实体边界和类型。",
    sampleData: [
      { review: "华为Mate60 Pro手机拍照效果很好，但电池续航不太行", productId: "SKU-30001", category: "手机" },
      { review: "耐克Air Max跑鞋很舒服，尺码偏大半码建议拍小一号", productId: "SKU-30002", category: "运动鞋" },
      { review: "小米电视75寸画质清晰，安装师傅很专业", productId: "SKU-30003", category: "电视" },
      { review: "兰蔻小黑瓶精华用了一周感觉皮肤变好了", productId: "SKU-30004", category: "护肤" },
      { review: "戴森V15吸尘器吸力很强但噪音太大了", productId: "SKU-30005", category: "家电" },
    ],
    schemaComponents: [
      { id: "raw_review", type: "showItem", label: "原始评论", dataPath: "$.raw.review", required: false, props: { template: "{{raw.review}}" }, validation: [] },
      { id: "product_entity", type: "shortText", label: "商品名称", dataPath: "$.annotation.product", required: true, props: { placeholder: "如: 华为Mate60 Pro" }, validation: [{ type: "required", message: "请抽取商品名" }] },
      { id: "brand_entity", type: "shortText", label: "品牌", dataPath: "$.annotation.brand", required: true, props: { placeholder: "如: 华为/耐克" }, validation: [{ type: "required", message: "请填写品牌" }] },
      { id: "attributes", type: "multiChoice", label: "提及属性", dataPath: "$.annotation.attributes", required: true, props: { options: ["外观", "性能", "价格", "尺寸", "续航", "噪音", "质量", "服务"], min: 1, max: 5 }, validation: [{ type: "required", message: "至少标一个属性" }] },
      { id: "sentiment_per_attr", type: "singleChoice", label: "属性情感", dataPath: "$.annotation.attrSentiment", required: true, props: { options: ["正面", "负面", "中性"] }, validation: [{ type: "required", message: "请选择" }] },
      { id: "evidence_span", type: "longText", label: "证据文本段", dataPath: "$.annotation.span", required: true, props: { placeholder: "粘贴原文中对应的文本片段" }, validation: [{ type: "required", message: "请填写" }] },
    ],
    rubricRules: [
      { ruleId: "R1", description: "实体抽取必须是原文出现的文本，不得修改", severity: "critical", appliesTo: ["product_entity", "brand_entity"], positiveExamples: ["原文写华为Mate60 Pro就填华为Mate60 Pro"], negativeExamples: ["自己缩写成华为M60P"], allowAgentAutoPass: false },
      { ruleId: "R2", description: "属性标注须与证据段对应，不可凭推测", severity: "high", appliesTo: ["attributes", "evidence_span"], positiveExamples: ["评论说续航不行标续航并引用原句"], negativeExamples: ["没提价格但标了价格"], allowAgentAutoPass: true },
      { ruleId: "R3", description: "同一评论多属性时应分别标注情感", severity: "medium", appliesTo: ["sentiment_per_attr"], positiveExamples: ["拍照好标正面，续航差标负面"], negativeExamples: ["统一标为正面"], allowAgentAutoPass: true },
    ],
    rubricDimensions: ["实体准确性", "边界精确度", "属性覆盖度", "情感一致性", "证据完整性"],
    assignmentPolicy: { mode: "auto_claim", replicasPerItem: 1, deadlineHours: 48, quotaPerLabeler: 30 },
    agentPolicy: { precheckEnabled: true, confidenceThreshold: 0.75, modelPreference: "deepseek-chat", promptTemplateVersionId: "ner_v1" },
    rationale: "电商实体抽取任务，重点在实体边界精确和属性-情感映射准确。",
  },
  task_qa_003: {
    taskId: "task_qa_003",
    taskName: "问答对质量评估",
    instruction: "评估 AI 生成的问答对质量，从准确性、完整性、流畅性和安全性四个维度打分（1-5），标注具体问题并给出改进建议。",
    sampleData: [
      { question: "Python中如何读取JSON文件？", answer: "使用json.load()函数，传入文件对象即可。", source: "code-qa", difficulty: "easy" },
      { question: "什么是量子计算？", answer: "量子计算利用量子比特可以同时处于多个状态的特性进行计算。", source: "science-qa", difficulty: "medium" },
      { question: "如何预防心血管疾病？", answer: "保持健康饮食和适度运动是关键。", source: "health-qa", difficulty: "medium" },
      { question: "React中useEffect的依赖数组作用？", answer: "控制副作用函数的执行时机，空数组表示只在挂载时执行。", source: "code-qa", difficulty: "medium" },
      { question: "黑洞是如何形成的？", answer: "大质量恒星耗尽燃料后引力坍缩形成。", source: "science-qa", difficulty: "hard" },
    ],
    schemaComponents: [
      { id: "qa_display", type: "showItem", label: "问答展示", dataPath: "$.raw", required: false, props: { template: "Q: {{raw.question}}\nA: {{raw.answer}}" }, validation: [] },
      { id: "accuracy_score", type: "singleChoice", label: "准确性评分", dataPath: "$.annotation.accuracy", required: true, props: { options: ["1-严重错误", "2-部分错误", "3-基本正确", "4-准确", "5-完全准确"] }, validation: [{ type: "required", message: "请评分" }] },
      { id: "completeness_score", type: "singleChoice", label: "完整性评分", dataPath: "$.annotation.completeness", required: true, props: { options: ["1-严重缺失", "2-明显不全", "3-基本覆盖", "4-较完整", "5-全面完整"] }, validation: [{ type: "required", message: "请评分" }] },
      { id: "fluency_score", type: "singleChoice", label: "流畅性评分", dataPath: "$.annotation.fluency", required: true, props: { options: ["1-难以理解", "2-表达混乱", "3-基本通顺", "4-流畅", "5-优美自然"] }, validation: [{ type: "required", message: "请评分" }] },
      { id: "safety_check", type: "singleChoice", label: "安全性", dataPath: "$.annotation.safety", required: true, props: { options: ["安全", "存在风险", "不安全"] }, validation: [{ type: "required", message: "请判断" }] },
      { id: "issues", type: "multiChoice", label: "存在问题", dataPath: "$.annotation.issues", required: false, props: { options: ["事实错误", "逻辑不通", "信息过时", "回答偏题", "缺少关键信息", "表述冗余", "无问题"], min: 0, max: 4 }, validation: [] },
      { id: "suggestion", type: "longText", label: "改进建议", dataPath: "$.annotation.suggestion", required: false, props: { placeholder: "针对发现的问题给出具体改进建议" }, validation: [] },
    ],
    rubricRules: [
      { ruleId: "R1", description: "评分必须与选择的问题类型一致，高分不能有严重问题", severity: "critical", appliesTo: ["accuracy_score", "issues"], positiveExamples: ["标了事实错误则准确性≤3"], negativeExamples: ["有事实错误但给5分"], allowAgentAutoPass: false },
      { ruleId: "R2", description: "安全性标注优先级最高，涉及健康/法律须谨慎", severity: "critical", appliesTo: ["safety_check"], positiveExamples: ["医疗建议标为存在风险"], negativeExamples: ["不专业医疗建议标为安全"], allowAgentAutoPass: false },
      { ruleId: "R3", description: "改进建议须具体可执行，不能泛泛而谈", severity: "medium", appliesTo: ["suggestion"], positiveExamples: ["建议补充json.load的参数说明和异常处理"], negativeExamples: ["建议改进一下"], allowAgentAutoPass: true },
    ],
    rubricDimensions: ["评分一致性", "问题识别能力", "安全意识", "建议质量"],
    assignmentPolicy: { mode: "auto_claim", replicasPerItem: 3, deadlineHours: 72, quotaPerLabeler: 20 },
    agentPolicy: { precheckEnabled: true, confidenceThreshold: 0.7, modelPreference: "deepseek-chat", promptTemplateVersionId: "qa_eval_v1" },
    rationale: "问答质量评估任务，多维度打分+具体问题标注，三人标注取共识。",
  },
};

const NEW_TASK_CONFIG: TaskConfig = {
  taskId: `task_${Date.now()}`,
  taskName: "",
  instruction: "",
  sampleData: [],
  schemaComponents: [],
  rubricRules: [],
  rubricDimensions: [],
  assignmentPolicy: { mode: "auto_claim", replicasPerItem: 1, deadlineHours: 24, quotaPerLabeler: 50 },
  agentPolicy: { precheckEnabled: true, confidenceThreshold: 0.8, modelPreference: "deepseek-chat", promptTemplateVersionId: "auto_v1" },
  rationale: "",
};

function loadConfigForTask(taskId?: string): TaskConfig {
  if (!taskId) return { ...NEW_TASK_CONFIG, taskId: `task_${Date.now()}` };
  const stored = typeof window !== "undefined" ? localStorage.getItem(`labelhub_task_${taskId}`) : null;
  if (stored) {
    try {
      const pkg = JSON.parse(stored);
      return {
        taskId: pkg.taskId || taskId,
        taskName: pkg.title || "",
        instruction: pkg.instruction || "",
        sampleData: pkg.sampleData || [],
        schemaComponents: pkg.schema?.components || [],
        rubricRules: pkg.rubric?.rules || [],
        rubricDimensions: pkg.rubric?.dimensions || [],
        assignmentPolicy: pkg.assignmentPolicy || NEW_TASK_CONFIG.assignmentPolicy,
        agentPolicy: pkg.agentPolicy || NEW_TASK_CONFIG.agentPolicy,
        rationale: pkg.rationale || "",
      };
    } catch { /* fall through */ }
  }
  if (TASK_CONFIGS[taskId]) return TASK_CONFIGS[taskId];
  return { ...NEW_TASK_CONFIG, taskId };
}

const componentTypeLabels: Record<string, string> = {
  shortText: "单行输入",
  longText: "多行文本",
  singleChoice: "单选",
  multiChoice: "多选",
  tagSelect: "标签选择",
  richText: "富文本",
  fileUpload: "文件上传",
  jsonEditor: "JSON 编辑器",
  llmInteraction: "LLM 交互",
  showItem: "展示项"
};

const COMPONENT_PRESETS: SchemaComponent[] = [
  { id: "", type: "singleChoice", label: "分类标签", dataPath: "$.annotation.category", required: true, props: { options: ["类别A", "类别B", "类别C", "其他"] }, validation: [{ type: "required", message: "请选择分类" }] },
  { id: "", type: "longText", label: "标注理由", dataPath: "$.annotation.reason", required: true, props: { placeholder: "请说明判断依据" }, validation: [{ type: "required", message: "请填写理由" }, { type: "minLength", value: 5, message: "至少5个字" }] },
  { id: "", type: "multiChoice", label: "标签多选", dataPath: "$.annotation.tags", required: false, props: { options: ["标签1", "标签2", "标签3"], min: 1, max: 3 }, validation: [] },
  { id: "", type: "showItem", label: "原始内容展示", dataPath: "$.raw.content", required: false, props: { template: "{{raw.content}}" }, validation: [] },
  { id: "", type: "shortText", label: "简要备注", dataPath: "$.annotation.note", required: false, props: { placeholder: "可选备注" }, validation: [] },
  { id: "", type: "fileUpload", label: "截图上传", dataPath: "$.annotation.files", required: false, props: { accept: ["image/png", "image/jpeg"], maxFiles: 3 }, validation: [] },
];

import { AuditBusinessDag, type BusinessNode } from "./AuditBusinessDag";

type DagResultType = { pipelineId: string; stages: { stage: string; status: string; durationMs: number; output: Record<string, unknown>; summary: string }[]; allPassed: boolean };

type AuditCachePayload = {
  schemaVersion?: number;
  detailsVersion?: number;
  traceCompleteness?: boolean;
  createdAt?: string;
  hash: string;
  configHash?: string;
  traceId?: string;
  businessNodes?: BusinessNode[];
  result: DagResultType;
};

const AUDIT_CACHE_SCHEMA_VERSION = 2;
const AUDIT_DETAILS_VERSION = 2;

function isValidAuditCache(cache: AuditCachePayload | null, configHash: string): boolean {
  if (!cache) return false;
  if (cache.schemaVersion !== AUDIT_CACHE_SCHEMA_VERSION) return false;
  const cachedHash = cache.configHash || cache.hash;
  if (cachedHash !== configHash) return false;
  if (cache.traceCompleteness === false) return false;
  if (!cache.traceId || !cache.businessNodes?.length) return false;
  return cache.businessNodes.every((node) => {
    const d = node.details;
    if (!d?.agent || !d?.traceId) return false;
    if (String(d.traceId) !== cache.traceId) return false;
    const version = Number(d.detailsVersion ?? d.schemaVersion ?? 0);
    return version >= AUDIT_DETAILS_VERSION;
  });
}

async function computeBackendConfigHash(config: TaskConfig): Promise<string> {
  const canonical = JSON.stringify({
    taskName: config.taskName || "",
    instruction: config.instruction || "",
    sampleDataCount: config.sampleData.length,
    schemaCount: config.schemaComponents.length,
    rubricCount: config.rubricRules.length,
    dimensionCount: config.rubricDimensions.length,
  });
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(canonical));
  const hex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.substring(0, 16);
}

function loadAuditCache(taskId: string): AuditCachePayload | null {
  try {
    const raw = localStorage.getItem(`labelhub_audit_run_${taskId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveAuditCache(taskId: string, payload: AuditCachePayload) {
  try {
    localStorage.setItem(`labelhub_audit_run_${taskId}`, JSON.stringify(payload));
  } catch { /* quota exceeded */ }
}

export function TaskStepper({ taskId, initialStep }: { taskId?: string; initialStep?: string }) {
  const validStep = initialStep && STEPS.some(s => s.key === initialStep) ? initialStep as StepKey : "upload";
  const [step, setStep] = useState<StepKey>(validStep);
  const [config, setConfig] = useState<TaskConfig>(() => loadConfigForTask(taskId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [dagPassed, setDagPassed] = useState(false);
  const [dagReport, setDagReport] = useState<{ pipelineId: string; allPassed: boolean; totalMs: number; stages: { stage: string; status: string; durationMs: number; summary: string }[] } | null>(null);
  const [dagCache, setDagCache] = useState<AuditCachePayload | null>(null);
  const currentIdx = STEPS.findIndex((s) => s.key === step);

  function goNext() {
    if (currentIdx < STEPS.length - 1) setStep(STEPS[currentIdx + 1].key);
  }
  function goPrev() {
    if (currentIdx > 0) setStep(STEPS[currentIdx - 1].key);
  }
  function jumpTo(key: StepKey) { setStep(key); }

  const handleAiGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let sampleData = config.sampleData;
      if (sampleData.length === 0) {
        const sampleRes = await fetch("/agent-api/agents/generate-sample-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskName: config.taskName || "未命名任务", instruction: config.instruction || null, count: 6 }),
        });
        if (sampleRes.ok) {
          const sampleResult = await sampleRes.json();
          if (sampleResult.sampleData?.length > 0) {
            sampleData = sampleResult.sampleData;
            setConfig((prev) => ({ ...prev, sampleData }));
          }
        }
      }

      const res = await fetch("/agent-api/agents/generate-task-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: config.taskId,
          taskName: config.taskName || "未命名标注任务",
          instruction: config.instruction || "根据数据推断标注需求",
          sampleData: sampleData.slice(0, 5),
          traceId: `trace_${Date.now()}`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setConfig((prev) => ({
        ...prev,
        schemaComponents: data.schemaComponents || prev.schemaComponents,
        rubricRules: data.rubricRules || prev.rubricRules,
        rubricDimensions: data.rubricDimensions || prev.rubricDimensions,
        assignmentPolicy: data.assignmentPolicy || prev.assignmentPolicy,
        agentPolicy: data.agentPolicy || prev.agentPolicy,
        rationale: data.rationale || "",
      }));
      setStep("publish");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI 生成失败");
    } finally {
      setLoading(false);
    }
  }, [config]);

  function handlePublish() {
    const key = `labelhub_task_${config.taskId}`;
    const taskPackage = {
      taskId: config.taskId,
      title: config.taskName,
      instruction: config.instruction,
      status: "published",
      schema: { components: config.schemaComponents, frozen: true },
      rubric: { dimensions: config.rubricDimensions, rules: config.rubricRules },
      assignmentPolicy: config.assignmentPolicy,
      agentPolicy: config.agentPolicy,
      sampleItemCount: config.sampleData.length,
      sampleData: config.sampleData,
      publishedAt: new Date().toISOString(),
      dagReport: dagReport || undefined,
    };
    localStorage.setItem(key, JSON.stringify(taskPackage));
    const tasks = JSON.parse(localStorage.getItem("labelhub_published_tasks") || "[]");
    if (!tasks.includes(config.taskId)) tasks.push(config.taskId);
    localStorage.setItem("labelhub_published_tasks", JSON.stringify(tasks));
    setPublished(true);
  }

  if (published) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-success/30 bg-success/5 p-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
          <svg className="h-8 w-8 text-success" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-bold text-primary">任务发布成功</h2>
        <p className="mt-2 text-sm text-ink/60">B（标注工作台）和 C（审核工作台）现在可以通过 API 消费此任务包。</p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => { setPublished(false); setConfig({ ...NEW_TASK_CONFIG, taskId: `task_${Date.now()}` }); setStep("upload"); }} className="rounded-xl border border-primary/20 px-5 py-2.5 text-sm font-bold text-primary hover:border-accent">新建任务</button>
          <a href="/?view=list" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90">查看任务列表</a>
        </div>
      </div>
    );
  }

  const checks = getPublishChecks(config);
  const allPassed = checks.every((c) => c.ok);

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2">
        <a href="/?view=list" className="flex items-center gap-1 text-sm text-ink/50 hover:text-accent transition">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          返回任务列表
        </a>
        <span className="text-ink/20">/</span>
        <span className="text-sm font-bold text-primary truncate max-w-[200px]">{config.taskName || "新建任务"}</span>
      </div>

      {/* Progress Bar */}
      <div className="rounded-2xl border border-primary/10 bg-white p-5">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <button key={s.key} onClick={() => jumpTo(s.key)} className="flex flex-1 items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i < currentIdx ? "bg-success text-white" : i === currentIdx ? "bg-accent text-white" : "bg-surface text-ink/40"}`}>
                {i < currentIdx ? <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : s.num}
              </div>
              <span className={`text-sm font-bold ${i === currentIdx ? "text-primary" : "text-ink/40"}`}>{s.label}</span>
              {i < STEPS.length - 1 && <div className={`mx-2 h-px flex-1 ${i < currentIdx ? "bg-success" : "bg-primary/10"}`} />}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
          <button onClick={() => setError(null)} className="ml-3 font-bold underline">关闭</button>
        </div>
      )}

      {step === "upload" && <StepUpload config={config} setConfig={setConfig} onAiGenerate={handleAiGenerate} loading={loading} />}
      {step === "template" && <StepTemplate config={config} setConfig={setConfig} />}
      {step === "rules" && <StepRules config={config} setConfig={setConfig} />}
      {step === "publish" && (
        <StepPublish
          config={config}
          allPassed={allPassed}
          checks={checks}
          dagCache={dagCache}
          onJumpToStep={(s) => jumpTo(s as StepKey)}
          onDagResult={async (passed, report, extras) => {
            setDagPassed(passed);
            if (report) setDagReport(report);
            const hash = extras?.configHash || (await computeBackendConfigHash(config));
            const cacheEntry: AuditCachePayload = {
              schemaVersion: AUDIT_CACHE_SCHEMA_VERSION,
              detailsVersion: AUDIT_DETAILS_VERSION,
              traceCompleteness: extras?.traceCompleteness ?? true,
              createdAt: new Date().toISOString(),
              hash,
              configHash: extras?.configHash || hash,
              traceId: extras?.traceId,
              businessNodes: extras?.businessNodes,
              result: {
                pipelineId: report?.pipelineId || extras?.traceId || "",
                stages: (report?.stages || []).map(s => ({ ...s, output: {} })),
                allPassed: passed,
              },
            };
            setDagCache(cacheEntry);
            saveAuditCache(config.taskId, cacheEntry);
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <button onClick={goPrev} disabled={currentIdx === 0} className={`rounded-xl border border-primary/20 px-5 py-2.5 text-sm font-bold ${currentIdx === 0 ? "cursor-not-allowed text-ink/30" : "text-primary hover:border-accent"}`}>上一步</button>
        {currentIdx < STEPS.length - 1 ? (
          <button onClick={goNext} className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-accent/90">下一步</button>
        ) : (
          <button onClick={handlePublish} disabled={!(allPassed && dagPassed)} className={`rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-sm ${allPassed && dagPassed ? "bg-success hover:bg-success/90" : "bg-ink/20 cursor-not-allowed"}`}>
            {allPassed && dagPassed ? "发布任务" : !allPassed ? `还有 ${checks.filter(c => !c.ok).length} 项未通过` : "等待 AI 审核通过"}
          </button>
        )}
      </div>
    </div>
  );
}

function getPublishChecks(config: TaskConfig) {
  return [
    { label: "任务名称已填写", ok: config.taskName.trim().length > 0, hint: "前往步骤 1 填写", step: "upload" as StepKey },
    { label: "任务说明已填写", ok: config.instruction.trim().length > 0, hint: "前往步骤 1 填写", step: "upload" as StepKey },
    { label: "样例数据已导入", ok: config.sampleData.length > 0, hint: "前往步骤 1 导入数据", step: "upload" as StepKey },
    { label: "标注模板已配置", ok: config.schemaComponents.length > 0, hint: "前往步骤 2 添加组件", step: "template" as StepKey },
    { label: "质检规则已配置", ok: config.rubricRules.length > 0, hint: "前往步骤 3 添加规则", step: "rules" as StepKey },
    { label: "评分维度已配置", ok: config.rubricDimensions.length >= 4, hint: "前往步骤 3 添加维度", step: "rules" as StepKey },
    { label: "分配策略已设置", ok: config.assignmentPolicy.mode === "auto_claim", hint: "自动设置" },
    { label: "AI 预审已启用", ok: config.agentPolicy.precheckEnabled, hint: "自动设置" },
  ];
}

/* ─── Step 1: Upload Data ─── */

function StepUpload({ config, setConfig, onAiGenerate, loading }: { config: TaskConfig; setConfig: React.Dispatch<React.SetStateAction<TaskConfig>>; onAiGenerate: () => void; loading: boolean }) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [genSampleLoading, setGenSampleLoading] = useState(false);
  const [genCount, setGenCount] = useState(6);

  async function handleGenerateSample() {
    if (!config.taskName.trim()) { alert("请先输入任务名称"); return; }
    setGenSampleLoading(true);
    try {
      const res = await fetch("/agent-api/agents/generate-sample-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName: config.taskName, instruction: config.instruction || null, count: genCount }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.sampleData && data.sampleData.length > 0) {
        setConfig((prev) => ({ ...prev, sampleData: [...prev.sampleData, ...data.sampleData] }));
      }
    } catch (e) {
      alert("样例数据生成失败: " + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setGenSampleLoading(false);
    }
  }

  function parseAndSetData(text: string) {
    const trimmed = text.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const lines = trimmed.split("\n").filter(Boolean);
        const parsed = lines.length > 1 && !trimmed.startsWith("[")
          ? lines.map((l) => JSON.parse(l))
          : (() => { const p = JSON.parse(trimmed); return Array.isArray(p) ? p : [p]; })();
        setConfig((prev) => ({ ...prev, sampleData: parsed }));
        setPasteMode(false);
        return;
      } catch { /* fall through to CSV */ }
    }
    const lines = trimmed.split("\n").filter(Boolean);
    if (lines.length >= 2 && lines[0].includes(",")) {
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      });
      setConfig((prev) => ({ ...prev, sampleData: rows }));
      setPasteMode(false);
      return;
    }
    alert("无法解析数据，支持 JSON/JSONL/CSV 格式");
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseAndSetData(reader.result as string);
    reader.readAsText(file);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/10 bg-white p-6 space-y-4">
        <h2 className="text-xl font-bold text-primary">任务基本信息</h2>
        <div>
          <label className="block text-xs font-bold text-ink/60 mb-1">任务名称</label>
          <input type="text" value={config.taskName} onChange={(e) => setConfig((p) => ({ ...p, taskName: e.target.value }))} placeholder="例：电商评论意图分类" className="w-full rounded-xl border border-primary/15 px-4 py-2.5 text-sm focus:border-accent focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-ink/60 mb-1">任务说明（AI 据此生成配置）</label>
          <textarea value={config.instruction} onChange={(e) => setConfig((p) => ({ ...p, instruction: e.target.value }))} placeholder="描述标注需求，例如：根据电商评论判断意图（咨询/投诉/售后），标注问题类型并给出理由…" rows={3} className="w-full rounded-xl border border-primary/15 px-4 py-2.5 text-sm focus:border-accent focus:outline-none resize-none" />
        </div>
      </div>

      <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-primary">智能生成样例数据</h3>
          <p className="text-xs text-ink/50 mt-0.5">根据任务名称和说明，AI 自动生成贴合主题的样例数据（追加到已有数据）</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input type="number" min={1} max={20} value={genCount} onChange={(e) => setGenCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} className="w-14 rounded-lg border border-primary/15 px-2 py-2 text-sm text-center" />
          <span className="text-xs text-ink/50">条</span>
          <button onClick={handleGenerateSample} disabled={genSampleLoading || !config.taskName.trim()} className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white transition ${genSampleLoading || !config.taskName.trim() ? "bg-accent/40 cursor-not-allowed" : "bg-accent hover:bg-accent/90 shadow-sm"}`}>
            {genSampleLoading ? <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>生成中…</span> : "AI 生成样例"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <h3 className="text-lg font-bold text-primary">上传标注数据</h3>
        <p className="mt-1 text-sm text-ink/60">支持 JSON / JSONL / CSV 文件或直接粘贴，也可用上方 AI 生成</p>
        <div className="mt-4 flex gap-3">
          <label className="flex-1 cursor-pointer rounded-xl border-2 border-dashed border-primary/20 bg-surface p-6 text-center hover:border-accent transition">
            <input type="file" accept=".json,.jsonl,.csv" className="hidden" onChange={handleFileUpload} />
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10"><svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg></div>
            <p className="mt-2 text-sm font-bold text-primary">选择文件</p>
            <p className="text-xs text-ink/50">JSON / JSONL / CSV</p>
          </label>
          <button onClick={() => setPasteMode(!pasteMode)} className="flex-1 rounded-xl border-2 border-dashed border-primary/20 bg-surface p-6 text-center hover:border-accent transition">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10"><svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3a2.25 2.25 0 00-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg></div>
            <p className="mt-2 text-sm font-bold text-primary">粘贴数据</p>
            <p className="text-xs text-ink/50">JSON / JSONL / CSV</p>
          </button>
        </div>
        {pasteMode && (
          <div className="mt-4 space-y-2">
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'JSON 数组、每行一个 JSON，或 CSV（首行表头）'} rows={5} className="w-full rounded-xl border border-primary/15 px-4 py-3 text-sm font-mono focus:border-accent focus:outline-none resize-none" />
            <button onClick={() => parseAndSetData(pasteText)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">导入数据</button>
          </div>
        )}
      </div>

      {config.sampleData.length > 0 && <DataPreviewTable data={config.sampleData} setConfig={setConfig} taskName={config.taskName} instruction={config.instruction} />}

      <div className="rounded-2xl border-2 border-accent/30 bg-accent/5 p-6 text-center">
        <h3 className="text-lg font-bold text-primary">AI 一键生成任务配置</h3>
        <p className="mt-1 text-sm text-ink/60">根据任务说明和样例数据，自动生成标注模板、质检规则和分配策略</p>
        <button onClick={onAiGenerate} disabled={loading} className={`mt-4 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition ${loading ? "bg-accent/50 cursor-wait" : "bg-accent hover:bg-accent/90"}`}>
          {loading ? <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>AI 正在生成…</span> : "AI 一键配置 →"}
        </button>
        {config.rationale && <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-xs text-ink/70 text-left"><span className="font-bold text-accent">AI 说明：</span>{config.rationale}</p>}
      </div>
    </div>
  );
}

function DataPreviewTable({ data, setConfig, taskName, instruction }: { data: Record<string, unknown>[]; setConfig: React.Dispatch<React.SetStateAction<TaskConfig>>; taskName: string; instruction: string }) {
  const fields = Object.keys(data[0] || {});
  const [page, setPage] = useState(0);
  const [aiAppendLoading, setAiAppendLoading] = useState(false);
  const [aiFieldLoading, setAiFieldLoading] = useState(false);
  const [appendCount, setAppendCount] = useState(3);
  const [newFieldName, setNewFieldName] = useState("");
  const [showAddField, setShowAddField] = useState(false);
  const pageSize = 10;
  const totalPages = Math.ceil(data.length / pageSize);
  const pageData = data.slice(page * pageSize, (page + 1) * pageSize);

  function handleDeleteRow(idx: number) {
    const globalIdx = page * pageSize + idx;
    setConfig((prev) => ({ ...prev, sampleData: prev.sampleData.filter((_, i) => i !== globalIdx) }));
  }

  function handleAddRow() {
    const emptyRow: Record<string, unknown> = {};
    fields.forEach((f) => { emptyRow[f] = ""; });
    emptyRow["id"] = `sample_${String(data.length + 1).padStart(3, "0")}`;
    setConfig((prev) => ({ ...prev, sampleData: [...prev.sampleData, emptyRow] }));
    setPage(Math.floor(data.length / pageSize));
  }

  function handleAddColumn() {
    const name = newFieldName.trim();
    if (!name || fields.includes(name)) return;
    setConfig((prev) => ({ ...prev, sampleData: prev.sampleData.map((row) => ({ ...row, [name]: "" })) }));
    setNewFieldName("");
    setShowAddField(false);
  }

  function handleRemoveColumn(field: string) {
    if (field === "id") return;
    setConfig((prev) => ({ ...prev, sampleData: prev.sampleData.map((row) => { const { [field]: _, ...rest } = row as Record<string, unknown>; return rest; }) }));
  }

  async function handleAiGenerateField() {
    if (!taskName.trim() || data.length === 0) return;
    setAiFieldLoading(true);
    try {
      const res = await fetch("/agent-api/agents/generate-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName, instruction: instruction || null, existingFields: fields, sampleData: data.slice(0, 10) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.fieldName && result.values) {
        const fname = result.fieldName;
        setConfig((prev) => ({ ...prev, sampleData: prev.sampleData.map((row, i) => ({ ...row, [fname]: result.values[i] || "" })) }));
      }
    } catch (e) {
      alert("AI 字段生成失败: " + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setAiFieldLoading(false);
    }
  }

  async function handleAiAppend(countOverride?: number) {
    if (!taskName.trim()) return;
    setAiAppendLoading(true);
    const count = countOverride ?? appendCount;
    try {
      const res = await fetch("/agent-api/agents/generate-sample-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName, instruction: instruction || null, count }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.sampleData?.length > 0) {
        setConfig((prev) => ({ ...prev, sampleData: [...prev.sampleData, ...result.sampleData] }));
      }
    } catch (e) {
      alert("AI 追加生成失败: " + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setAiAppendLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-primary">数据预览</h3>
          <p className="text-xs text-ink/50">共 {data.length} 条数据，{fields.length} 个字段</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setConfig((prev) => ({ ...prev, sampleData: [] }))} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition">清空全部</button>
          <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">数据就绪</span>
        </div>
      </div>

      {/* Column Management Bar */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {showAddField ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-2 py-1">
            <input type="text" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); }} placeholder="字段名" className="w-24 border-none bg-transparent text-xs focus:outline-none" autoFocus />
            <button onClick={handleAddColumn} disabled={!newFieldName.trim() || fields.includes(newFieldName.trim())} className="rounded px-2 py-0.5 text-xs font-bold text-white bg-accent disabled:bg-accent/40">确定</button>
            <button onClick={() => { setShowAddField(false); setNewFieldName(""); }} className="text-xs text-ink/40 hover:text-ink/60">取消</button>
          </div>
        ) : (
          <button onClick={() => setShowAddField(true)} className="rounded-lg border border-dashed border-primary/20 px-3 py-1.5 text-xs text-ink/50 hover:text-primary hover:border-primary/30 transition">+ 新增字段</button>
        )}
        <button onClick={handleAiGenerateField} disabled={aiFieldLoading || !taskName.trim() || data.length === 0} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${aiFieldLoading ? "bg-accent/40 text-white cursor-wait" : "border border-accent/30 text-accent hover:bg-accent/5"}`}>
          {aiFieldLoading ? "生成中…" : "AI 生成字段"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-primary/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface/80">
              <th className="px-2 py-2 text-center text-xs font-bold text-ink/40 w-8">#</th>
              {fields.map((f) => (
                <th key={f} className="px-3 py-2 text-left text-xs font-bold text-ink/60 whitespace-nowrap group/col relative">
                  {f}
                  {f !== "id" && (
                    <button onClick={() => handleRemoveColumn(f)} className="absolute -top-0.5 -right-0.5 opacity-0 group-hover/col:opacity-100 flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-500 text-[9px] transition hover:bg-red-200" title={`删除字段 ${f}`}>&times;</button>
                  )}
                </th>
              ))}
              <th className="px-2 py-2 text-center text-xs font-bold text-ink/40 w-10">操作</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => {
              const globalIdx = page * pageSize + i;
              return (
                <tr key={globalIdx} className="border-t border-primary/5 group hover:bg-surface/50">
                  <td className="px-2 py-2 text-center text-xs text-ink/30">{globalIdx + 1}</td>
                  {fields.map((f) => (
                    <td key={f} className="px-1 py-1">
                      <input type="text" value={String(row[f] ?? "")} onChange={(e) => { const val = e.target.value; setConfig((prev) => ({ ...prev, sampleData: prev.sampleData.map((r, ri) => ri === globalIdx ? { ...r, [f]: val } : r) })); }} className="w-full rounded border border-transparent hover:border-primary/15 focus:border-accent px-2 py-1 text-xs text-ink/80 focus:outline-none bg-transparent" />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => handleDeleteRow(i)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition" title="删除此行">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-lg border px-2.5 py-1 text-xs disabled:opacity-30">上一页</button>
          <span className="text-xs text-ink/50">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="rounded-lg border px-2.5 py-1 text-xs disabled:opacity-30">下一页</button>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button onClick={() => handleAiAppend(1)} disabled={aiAppendLoading || !taskName.trim()} className="rounded-xl border border-dashed border-accent/30 px-4 py-2 text-sm text-accent hover:bg-accent/5 transition disabled:opacity-40">+ AI 智能生成 1 行</button>
        <div className="flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-1.5">
          <span className="text-xs text-ink/60">批量生成</span>
          <input type="number" min={1} max={20} value={appendCount} onChange={(e) => setAppendCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} className="w-12 rounded-lg border border-primary/15 px-2 py-1 text-xs text-center" />
          <span className="text-xs text-ink/60">条</span>
          <button onClick={() => handleAiAppend()} disabled={aiAppendLoading || !taskName.trim()} className={`rounded-lg px-3 py-1 text-xs font-bold text-white transition ${aiAppendLoading || !taskName.trim() ? "bg-accent/40 cursor-not-allowed" : "bg-accent hover:bg-accent/90"}`}>
            {aiAppendLoading ? "生成中…" : "AI 生成"}
          </button>
        </div>
        <button onClick={handleAddRow} className="rounded-xl border border-dashed border-primary/20 px-4 py-2 text-sm text-ink/40 hover:text-primary hover:border-primary/30 transition">+ 手动空行</button>
      </div>
    </div>
  );
}

/* ─── Step 2: Template Builder ─── */

function StepTemplate({ config, setConfig }: { config: TaskConfig; setConfig: React.Dispatch<React.SetStateAction<TaskConfig>> }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(config.schemaComponents.length > 0 ? 0 : null);
  const [showPresets, setShowPresets] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const selected = selectedIdx !== null ? config.schemaComponents[selectedIdx] : null;

  async function handleAiGenTemplate() {
    setAiLoading(true);
    try {
      const res = await fetch("/agent-api/agents/generate-task-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName: config.taskName || "未命名任务", instruction: config.instruction || "", sampleData: config.sampleData.slice(0, 5) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.schemaComponents?.length > 0) {
        setConfig((prev) => ({ ...prev, schemaComponents: data.schemaComponents }));
        setSelectedIdx(0);
      }
    } catch (e) { alert("AI 生成模板失败: " + (e instanceof Error ? e.message : "未知错误")); }
    finally { setAiLoading(false); }
  }

  function updateComponent(idx: number, patch: Partial<SchemaComponent>) {
    setConfig((prev) => ({ ...prev, schemaComponents: prev.schemaComponents.map((c, i) => (i === idx ? { ...c, ...patch } : c)) }));
  }
  function updateProps(idx: number, propPatch: Record<string, unknown>) {
    setConfig((prev) => ({ ...prev, schemaComponents: prev.schemaComponents.map((c, i) => (i === idx ? { ...c, props: { ...c.props, ...propPatch } } : c)) }));
  }
  function removeComponent(idx: number) {
    setConfig((prev) => ({ ...prev, schemaComponents: prev.schemaComponents.filter((_, i) => i !== idx) }));
    setSelectedIdx(null);
  }
  function addFromPreset(preset: SchemaComponent) {
    const newComp = { ...preset, id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
    setConfig((prev) => ({ ...prev, schemaComponents: [...prev.schemaComponents, newComp] }));
    setSelectedIdx(config.schemaComponents.length);
    setShowPresets(false);
  }

  function getComponentSummary(c: SchemaComponent): string {
    const opts = c.props.options as string[] | undefined;
    if (opts && opts.length > 0) return opts.slice(0, 3).join("/") + (opts.length > 3 ? "..." : "");
    if (c.props.placeholder) return String(c.props.placeholder).slice(0, 20);
    if (c.props.template) return String(c.props.template).slice(0, 20);
    return "";
  }

  return (
    <div className="rounded-2xl border border-primary/10 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-primary/10 px-5 py-4">
        <div>
          <h2 className="text-xl font-bold text-primary">配置标注模板</h2>
          <p className="text-sm text-ink/50">点击组件编辑属性，配置选项和校验规则</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">{config.schemaComponents.length} 个组件</span>
          <button onClick={handleAiGenTemplate} disabled={aiLoading} className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white transition ${aiLoading ? "bg-accent/50 cursor-wait" : "bg-accent hover:bg-accent/90"}`}>
            {aiLoading ? "AI 生成中…" : "AI 智能生成"}
          </button>
          <button onClick={() => setShowPresets(true)} className="rounded-lg border border-accent px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/5">+ 添加组件</button>
        </div>
      </div>

      {showPresets && (
        <div className="border-b border-primary/10 bg-accent/5 p-4">
          <p className="text-sm font-bold text-primary mb-3">选择组件模板：</p>
          <div className="grid grid-cols-2 gap-2">
            {COMPONENT_PRESETS.map((p, i) => (
              <button key={i} onClick={() => addFromPreset(p)} className="flex items-center gap-2 rounded-lg border border-primary/10 bg-white px-3 py-2 text-left hover:border-accent transition">
                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">{componentTypeLabels[p.type]}</span>
                <span className="text-sm text-primary">{p.label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowPresets(false)} className="mt-2 text-xs text-ink/50 hover:text-primary">取消</button>
        </div>
      )}

      {config.schemaComponents.length === 0 ? (
        <div className="p-10 text-center text-ink/40">
          <p className="text-lg font-bold">暂无组件</p>
          <p className="mt-1 text-sm">点击上方"添加组件"选择预设，或返回上一步使用 AI 生成。</p>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-[400px] bg-surface/20 p-4 space-y-2">
            {config.schemaComponents.map((c, i) => (
              <div key={c.id} onClick={() => setSelectedIdx(i)} className={`cursor-pointer rounded-xl border bg-white px-4 py-3 transition ${selectedIdx === i ? "border-accent shadow-sm" : "border-primary/10 hover:border-accent/40"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">{componentTypeLabels[c.type] || c.type}</span>
                    <span className="text-sm font-bold text-primary">{c.label}</span>
                    {c.required && <span className="text-danger text-xs">*</span>}
                  </div>
                  <span className="font-mono text-[10px] text-ink/40">{c.dataPath}</span>
                </div>
                {getComponentSummary(c) && <p className="mt-1 text-xs text-ink/50 truncate">{getComponentSummary(c)}</p>}
              </div>
            ))}
          </div>

          <aside className="border-l border-primary/10 p-4 overflow-y-auto max-h-[550px]">
            <p className="text-xs font-bold text-ink/40 mb-3">属性编辑</p>
            {selected && selectedIdx !== null ? (
              <div className="space-y-3">
                <EditField label="名称" value={selected.label} onChange={(v) => updateComponent(selectedIdx, { label: v })} />
                <EditField label="数据路径" value={selected.dataPath} onChange={(v) => updateComponent(selectedIdx, { dataPath: v })} mono />
                <div>
                  <label className="block text-xs font-bold text-ink/40 mb-1">类型</label>
                  <select value={selected.type} onChange={(e) => updateComponent(selectedIdx, { type: e.target.value })} className="w-full rounded-lg border border-primary/15 px-3 py-1.5 text-sm focus:border-accent focus:outline-none">
                    {Object.entries(componentTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.required} onChange={(e) => updateComponent(selectedIdx, { required: e.target.checked })} className="rounded" />
                  <span className="text-sm text-primary">必填</span>
                </div>

                {/* Type-specific props editor */}
                <PropsEditor component={selected} idx={selectedIdx} updateProps={updateProps} />

                <button onClick={() => removeComponent(selectedIdx)} className="mt-2 w-full rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger/5">删除此组件</button>
              </div>
            ) : (
              <p className="text-xs text-ink/40">点击左侧组件查看属性</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function PropsEditor({ component, idx, updateProps }: { component: SchemaComponent; idx: number; updateProps: (idx: number, p: Record<string, unknown>) => void }) {
  const type = component.type;
  const props = component.props;
  const [newOpt, setNewOpt] = useState("");

  if (type === "singleChoice" || type === "multiChoice" || type === "tagSelect") {
    const options = (props.options as string[]) || [];
    return (
      <div className="rounded-lg border border-primary/10 bg-surface/50 p-3 space-y-2">
        <p className="text-xs font-bold text-ink/60">选项列表</p>
        <div className="space-y-1">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="flex-1 rounded bg-white px-2 py-1 text-xs border border-primary/10">{opt}</span>
              <button onClick={() => updateProps(idx, { options: options.filter((_, j) => j !== i) })} className="text-danger text-xs hover:underline">删</button>
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <input value={newOpt} onChange={(e) => setNewOpt(e.target.value)} placeholder="新增选项" className="flex-1 rounded border border-primary/15 px-2 py-1 text-xs focus:border-accent focus:outline-none" onKeyDown={(e) => { if (e.key === "Enter" && newOpt.trim()) { updateProps(idx, { options: [...options, newOpt.trim()] }); setNewOpt(""); } }} />
          <button onClick={() => { if (newOpt.trim()) { updateProps(idx, { options: [...options, newOpt.trim()] }); setNewOpt(""); } }} className="rounded bg-accent/10 px-2 py-1 text-xs font-bold text-accent">添加</button>
        </div>
        {(type === "multiChoice" || type === "tagSelect") && (
          <div className="flex gap-2 text-xs">
            <label className="flex items-center gap-1">最少 <input type="number" value={(props.min as number) || 0} onChange={(e) => updateProps(idx, { min: +e.target.value })} className="w-12 rounded border px-1 py-0.5 text-center" /></label>
            <label className="flex items-center gap-1">最多 <input type="number" value={(props.max as number) || 10} onChange={(e) => updateProps(idx, { max: +e.target.value })} className="w-12 rounded border px-1 py-0.5 text-center" /></label>
          </div>
        )}
      </div>
    );
  }

  if (type === "shortText" || type === "longText") {
    return (
      <div className="rounded-lg border border-primary/10 bg-surface/50 p-3">
        <p className="text-xs font-bold text-ink/60 mb-1">占位提示</p>
        <input value={(props.placeholder as string) || ""} onChange={(e) => updateProps(idx, { placeholder: e.target.value })} placeholder="输入框提示文字" className="w-full rounded border border-primary/15 px-2 py-1 text-xs focus:border-accent focus:outline-none" />
      </div>
    );
  }

  if (type === "showItem") {
    return (
      <div className="rounded-lg border border-primary/10 bg-surface/50 p-3">
        <p className="text-xs font-bold text-ink/60 mb-1">展示模板</p>
        <input value={(props.template as string) || ""} onChange={(e) => updateProps(idx, { template: e.target.value })} placeholder="如 {{raw.comment}}" className="w-full rounded border border-primary/15 px-2 py-1 text-xs font-mono focus:border-accent focus:outline-none" />
      </div>
    );
  }

  if (type === "fileUpload") {
    return (
      <div className="rounded-lg border border-primary/10 bg-surface/50 p-3 space-y-2">
        <p className="text-xs font-bold text-ink/60">文件上传配置</p>
        <label className="flex items-center gap-1 text-xs">最大文件数 <input type="number" value={(props.maxFiles as number) || 3} onChange={(e) => updateProps(idx, { maxFiles: +e.target.value })} className="w-12 rounded border px-1 py-0.5 text-center" /></label>
        <p className="text-[10px] text-ink/40">接受格式：{((props.accept as string[]) || []).join(", ") || "所有"}</p>
      </div>
    );
  }

  if (type === "llmInteraction") {
    return (
      <div className="rounded-lg border border-primary/10 bg-surface/50 p-3 space-y-2">
        <p className="text-xs font-bold text-ink/60">LLM Prompt</p>
        <textarea value={(props.prompt as string) || ""} onChange={(e) => updateProps(idx, { prompt: e.target.value })} rows={3} placeholder="请判断这条数据..." className="w-full rounded border border-primary/15 px-2 py-1 text-xs focus:border-accent focus:outline-none resize-none" />
      </div>
    );
  }

  return null;
}

function EditField({ label, value, onChange, mono }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-bold text-ink/40 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-lg border border-primary/15 px-3 py-1.5 text-sm focus:border-accent focus:outline-none ${mono ? "font-mono" : ""}`} />
    </div>
  );
}

/* ─── Step 3: Rubric Rules ─── */

function StepRules({ config, setConfig }: { config: TaskConfig; setConfig: React.Dispatch<React.SetStateAction<TaskConfig>> }) {
  const [newDim, setNewDim] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  async function handleAiGenRules() {
    setAiLoading(true);
    try {
      const res = await fetch("/agent-api/agents/generate-task-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName: config.taskName || "未命名任务", instruction: config.instruction || "", sampleData: config.sampleData.slice(0, 5) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.rubricRules?.length > 0) setConfig((prev) => ({ ...prev, rubricRules: data.rubricRules }));
      if (data.rubricDimensions?.length > 0) setConfig((prev) => ({ ...prev, rubricDimensions: data.rubricDimensions }));
    } catch (e) { alert("AI 生成规则失败: " + (e instanceof Error ? e.message : "未知错误")); }
    finally { setAiLoading(false); }
  }

  function updateRule(idx: number, patch: Partial<RubricRule>) {
    setConfig((prev) => ({ ...prev, rubricRules: prev.rubricRules.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  }
  function addRule() {
    setConfig((prev) => ({ ...prev, rubricRules: [...prev.rubricRules, { ruleId: `R${prev.rubricRules.length + 1}`, description: "", severity: "medium", appliesTo: [], positiveExamples: [], negativeExamples: [], allowAgentAutoPass: false }] }));
  }
  function removeRule(idx: number) {
    setConfig((prev) => ({ ...prev, rubricRules: prev.rubricRules.filter((_, i) => i !== idx) }));
  }
  function addDimension() {
    if (newDim.trim() && !config.rubricDimensions.includes(newDim.trim())) {
      setConfig((prev) => ({ ...prev, rubricDimensions: [...prev.rubricDimensions, newDim.trim()] }));
      setNewDim("");
    }
  }
  function removeDimension(d: string) {
    setConfig((prev) => ({ ...prev, rubricDimensions: prev.rubricDimensions.filter((x) => x !== d) }));
  }

  const RULE_PRESETS = [
    { description: "标注结论必须有原文依据", severity: "high", positiveExamples: ["引用了原文关键信息"], negativeExamples: ["没有依据直接下结论"] },
    { description: "理由字数不少于 10 字", severity: "medium", positiveExamples: ["详细说明了判断过程"], negativeExamples: ["只写了一两个字"] },
    { description: "选项必须与原文内容对应", severity: "high", positiveExamples: ["评论提到物流慢选了物流"], negativeExamples: ["随意选择不相关选项"] },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary">质检规则</h2>
            <p className="mt-1 text-sm text-ink/60">配置评分维度和质检规则，关联到具体标注组件</p>
          </div>
          <button onClick={handleAiGenRules} disabled={aiLoading} className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white transition ${aiLoading ? "bg-accent/50 cursor-wait" : "bg-accent hover:bg-accent/90"}`}>
            {aiLoading ? "AI 生成中…" : "AI 智能生成"}
          </button>
          <button onClick={addRule} className="rounded-lg border border-accent px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/5">+ 新增规则</button>
        </div>

        {/* Dimensions */}
        <div className="mt-5">
          <p className="text-sm font-bold text-primary mb-2">评分维度</p>
          <div className="flex flex-wrap gap-2">
            {config.rubricDimensions.map((d) => (
              <span key={d} className="group flex items-center gap-1 rounded-full border border-accent/30 bg-accent/5 px-3 py-1.5 text-sm font-bold text-accent">
                {d}
                <button onClick={() => removeDimension(d)} className="hidden group-hover:inline text-danger/60 hover:text-danger ml-1">&times;</button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input value={newDim} onChange={(e) => setNewDim(e.target.value)} placeholder="新维度" className="w-20 rounded border border-primary/15 px-2 py-1 text-xs focus:border-accent focus:outline-none" onKeyDown={(e) => { if (e.key === "Enter") addDimension(); }} />
              <button onClick={addDimension} className="rounded bg-accent/10 px-2 py-1 text-xs font-bold text-accent">+</button>
            </div>
          </div>
        </div>

        {/* Quick presets */}
        {config.rubricRules.length === 0 && (
          <div className="mt-4 rounded-xl border border-primary/10 bg-surface/50 p-4">
            <p className="text-sm font-bold text-primary mb-2">快速添加规则模板：</p>
            <div className="space-y-1">
              {RULE_PRESETS.map((p, i) => (
                <button key={i} onClick={() => setConfig((prev) => ({ ...prev, rubricRules: [...prev.rubricRules, { ruleId: `R${prev.rubricRules.length + 1}`, ...p, appliesTo: [], allowAgentAutoPass: false }] }))} className="block w-full rounded-lg border border-primary/10 bg-white px-3 py-2 text-left text-sm hover:border-accent transition">{p.description}</button>
              ))}
            </div>
          </div>
        )}

        {/* Rules */}
        {config.rubricRules.length > 0 && (
          <div className="mt-5 space-y-4">
            {config.rubricRules.map((rule, idx) => (
              <RuleCard key={rule.ruleId} rule={rule} idx={idx} components={config.schemaComponents} updateRule={updateRule} removeRule={removeRule} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RuleCard({ rule, idx, components, updateRule, removeRule }: { rule: RubricRule; idx: number; components: SchemaComponent[]; updateRule: (i: number, p: Partial<RubricRule>) => void; removeRule: (i: number) => void }) {
  const [newPos, setNewPos] = useState("");
  const [newNeg, setNewNeg] = useState("");

  return (
    <div className="rounded-xl border border-primary/10 bg-surface/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{rule.ruleId}</span>
        <input type="text" value={rule.description} onChange={(e) => updateRule(idx, { description: e.target.value })} placeholder="规则描述" className="flex-1 rounded-lg border border-primary/15 px-3 py-1.5 text-sm focus:border-accent focus:outline-none" />
        <select value={rule.severity} onChange={(e) => updateRule(idx, { severity: e.target.value })} className="rounded-lg border border-primary/15 px-2 py-1.5 text-xs focus:border-accent focus:outline-none">
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="critical">严重</option>
        </select>
        <button onClick={() => removeRule(idx)} className="text-danger text-xs font-bold hover:underline">删除</button>
      </div>

      {/* AppliesTo */}
      <div>
        <p className="text-xs font-bold text-ink/50 mb-1">关联组件</p>
        <div className="flex flex-wrap gap-1">
          {components.map((c) => (
            <button key={c.id} onClick={() => { const current = rule.appliesTo.includes(c.id) ? rule.appliesTo.filter((x) => x !== c.id) : [...rule.appliesTo, c.id]; updateRule(idx, { appliesTo: current }); }} className={`rounded px-2 py-0.5 text-[10px] font-bold border transition ${rule.appliesTo.includes(c.id) ? "bg-accent/10 border-accent text-accent" : "border-primary/15 text-ink/50 hover:border-accent/50"}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Examples */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-bold text-success mb-1">正例</p>
          {rule.positiveExamples.map((ex, i) => (
            <div key={i} className="flex items-center gap-1 mb-1">
              <span className="flex-1 rounded bg-success/5 border border-success/20 px-2 py-1 text-xs">{ex}</span>
              <button onClick={() => updateRule(idx, { positiveExamples: rule.positiveExamples.filter((_, j) => j !== i) })} className="text-ink/30 hover:text-danger text-xs">&times;</button>
            </div>
          ))}
          <div className="flex gap-1">
            <input value={newPos} onChange={(e) => setNewPos(e.target.value)} placeholder="添加正例" className="flex-1 rounded border border-primary/15 px-2 py-0.5 text-[11px] focus:border-accent focus:outline-none" onKeyDown={(e) => { if (e.key === "Enter" && newPos.trim()) { updateRule(idx, { positiveExamples: [...rule.positiveExamples, newPos.trim()] }); setNewPos(""); } }} />
            <button onClick={() => { if (newPos.trim()) { updateRule(idx, { positiveExamples: [...rule.positiveExamples, newPos.trim()] }); setNewPos(""); } }} className="text-xs text-success font-bold">+</button>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-danger mb-1">负例</p>
          {rule.negativeExamples.map((ex, i) => (
            <div key={i} className="flex items-center gap-1 mb-1">
              <span className="flex-1 rounded bg-danger/5 border border-danger/20 px-2 py-1 text-xs">{ex}</span>
              <button onClick={() => updateRule(idx, { negativeExamples: rule.negativeExamples.filter((_, j) => j !== i) })} className="text-ink/30 hover:text-danger text-xs">&times;</button>
            </div>
          ))}
          <div className="flex gap-1">
            <input value={newNeg} onChange={(e) => setNewNeg(e.target.value)} placeholder="添加负例" className="flex-1 rounded border border-primary/15 px-2 py-0.5 text-[11px] focus:border-accent focus:outline-none" onKeyDown={(e) => { if (e.key === "Enter" && newNeg.trim()) { updateRule(idx, { negativeExamples: [...rule.negativeExamples, newNeg.trim()] }); setNewNeg(""); } }} />
            <button onClick={() => { if (newNeg.trim()) { updateRule(idx, { negativeExamples: [...rule.negativeExamples, newNeg.trim()] }); setNewNeg(""); } }} className="text-xs text-danger font-bold">+</button>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink/60">
        <input type="checkbox" checked={rule.allowAgentAutoPass} onChange={(e) => updateRule(idx, { allowAgentAutoPass: e.target.checked })} className="rounded" />
        允许 Agent 自动通过
      </label>
    </div>
  );
}

/* ─── Step 4: Publish ─── */

const AUDIT_LABELS: Record<string, string> = {
  task_context_builder: "任务说明",
  dataset_sampler: "样例数据",
  schema_generator: "标注模板",
  rubric_generator: "质检规则",
  critic: "综合评估",
  task_package_writer: "发布准备",
};

function StepPublish({
  config,
  allPassed,
  checks,
  onDagResult,
  dagCache,
  onJumpToStep,
}: {
  config: TaskConfig;
  allPassed: boolean;
  checks: { label: string; ok: boolean; step?: StepKey; hint?: string }[];
  onDagResult: (
    passed: boolean,
    report?: { pipelineId: string; allPassed: boolean; totalMs: number; stages: { stage: string; status: string; durationMs: number; summary: string }[] },
    extras?: { traceId?: string; configHash?: string; businessNodes?: BusinessNode[]; traceCompleteness?: boolean }
  ) => void;
  dagCache: AuditCachePayload | null;
  onJumpToStep: (step: string) => void;
}) {
  const [dagLoading, setDagLoading] = useState(false);
  const [dagResult, setDagResult] = useState<DagResultType | null>(null);
  const [dagHash, setDagHash] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [businessNodes, setBusinessNodes] = useState<BusinessNode[]>([]);
  const [traceNodes, setTraceNodes] = useState<{ id: string; type: string; title: string; status: string; durationMs: number; rag?: Record<string, unknown>; skill?: Record<string, unknown> }[]>([]);
  const [traceId, setTraceId] = useState<string>("");
  const [fromCache, setFromCache] = useState(false);
  const [showDevTrace, setShowDevTrace] = useState(false);
  const [currentHash, setCurrentHash] = useState("");
  const [cacheRejected, setCacheRejected] = useState(false);

  function clearAuditState() {
    setDagResult(null);
    setBusinessNodes([]);
    setTraceNodes([]);
    setTraceId("");
    setFromCache(false);
    setDagHash("");
  }

  async function applyAuditPayload(data: {
    traceId?: string;
    configHash?: string;
    status?: string;
    durationMs?: number;
    fromCache?: boolean;
    traceCompleteness?: boolean;
    businessDag?: BusinessNode[];
    developerDag?: { id: string; type: string; title: string; status: string; durationMs: number }[];
  }, hash: string) {
    const nodes: BusinessNode[] = data.businessDag || [];
    setBusinessNodes(nodes);
    setTraceNodes(data.developerDag || []);
    setTraceId(data.traceId || "");
    setFromCache(data.fromCache === true);

    const ap = data.status === "success";
    const totalMs = data.durationMs || 0;
    const stages = nodes.map((n: BusinessNode) => ({
      stage: n.nodeKey, status: n.status, durationMs: n.durationMs, summary: n.summary, output: {},
    }));

    setDagResult({ pipelineId: data.traceId || "", stages, allPassed: ap });
    const backendHash = data.configHash || hash;
    setDagHash(backendHash);
    setCurrentHash(backendHash);
    onDagResult(ap, { pipelineId: data.traceId || "", allPassed: ap, totalMs, stages }, {
      traceId: data.traceId,
      configHash: data.configHash,
      businessNodes: nodes,
      traceCompleteness: data.traceCompleteness,
    });
  }

  async function runAuditCheck(forceRun = false) {
    setDagLoading(true);
    try {
      const res = await fetch("/agent-api/agents/audit-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: config.taskId,
          taskName: config.taskName,
          instruction: config.instruction,
          sampleData: config.sampleData.slice(0, 10),
          schemaComponents: config.schemaComponents,
          rubricRules: config.rubricRules,
          rubricDimensions: config.rubricDimensions,
          forceRun,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const hash = data.configHash || currentHash || (await computeBackendConfigHash(config));
      await applyAuditPayload(data, hash);

      const cacheEntry: AuditCachePayload = {
        schemaVersion: AUDIT_CACHE_SCHEMA_VERSION,
        detailsVersion: AUDIT_DETAILS_VERSION,
        traceCompleteness: data.traceCompleteness !== false,
        createdAt: new Date().toISOString(),
        hash,
        configHash: data.configHash || hash,
        traceId: data.traceId,
        businessNodes: data.businessDag || [],
        result: {
          pipelineId: data.traceId || "",
          stages: (data.businessDag || []).map((n: BusinessNode) => ({
            stage: n.nodeKey, status: n.status, durationMs: n.durationMs, summary: n.summary, output: {},
          })),
          allPassed: data.status === "success",
        },
      };
      saveAuditCache(config.taskId, cacheEntry);
    } catch (e) {
      alert("审核执行失败: " + (e instanceof Error ? e.message : ""));
      onDagResult(false);
    } finally {
      setDagLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initAudit() {
      const hash = await computeBackendConfigHash(config);
      if (cancelled) return;
      setCurrentHash(hash);
      clearAuditState();

      const localCache = loadAuditCache(config.taskId);

      try {
        const serverRes = await fetch(`/agent-api/agents/audit-runs/by-task/${encodeURIComponent(config.taskId)}?configHash=${encodeURIComponent(hash)}`);
        if (serverRes.ok) {
          const data = await serverRes.json();
          if (!cancelled) {
            await applyAuditPayload(data, hash);
            setCacheRejected(false);
          }
          return;
        }
      } catch {
        /* server unavailable — fall back to local cache */
      }

      if (isValidAuditCache(localCache, hash)) {
        setDagResult(localCache!.result);
        setDagHash(hash);
        setFromCache(true);
        setCacheRejected(false);
        if (localCache!.businessNodes?.length) setBusinessNodes(localCache!.businessNodes);
        if (localCache!.traceId) setTraceId(localCache!.traceId);
        const totalMs = localCache!.result.stages?.reduce((s: number, x: { durationMs: number }) => s + x.durationMs, 0) || 0;
        onDagResult(localCache!.result.allPassed === true, {
          pipelineId: localCache!.traceId || localCache!.result.pipelineId,
          allPassed: localCache!.result.allPassed,
          totalMs,
          stages: localCache!.result.stages.map(s => ({ stage: s.stage, status: s.status, durationMs: s.durationMs, summary: s.summary })),
        }, {
          traceId: localCache!.traceId,
          configHash: hash,
          businessNodes: localCache!.businessNodes,
          traceCompleteness: localCache!.traceCompleteness,
        });
        return;
      }

      if (localCache) {
        try { localStorage.removeItem(`labelhub_audit_run_${config.taskId}`); } catch { /* ignore */ }
        clearAuditState();
        setCacheRejected(true);
      }

      if (config.taskName.trim()) {
        runAuditCheck(false);
      }
    }

    initAudit();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isCacheValid = !cacheRejected && isValidAuditCache(loadAuditCache(config.taskId), currentHash) && dagResult !== null;
  const canPublish = allPassed && dagResult?.allPassed === true;
  const failedChecks = checks.filter(c => !c.ok);

  return (
    <div className="space-y-5 min-w-0">
      {/* Actionable Validation Checklist */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-primary">发布前检查</h3>
          {allPassed ? (
            <span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success">全部通过</span>
          ) : (
            <span className="rounded-full bg-warning/10 px-3 py-1.5 text-xs font-bold text-warning">还需完成 {failedChecks.length} 项</span>
          )}
        </div>

        {failedChecks.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-bold text-ink/40">需要修复:</p>
            {failedChecks.map(c => (
              <div key={c.label} className="flex items-center gap-3 rounded-xl bg-warning/5 border border-warning/20 px-4 py-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning/15 text-warning text-xs font-bold">!</span>
                <span className="text-sm text-primary flex-1">{c.label}</span>
                {c.hint && <span className="text-xs text-ink/40">{c.hint}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2 md:grid-cols-2">
          {checks.filter(c => c.ok).map(c => (
            <div key={c.label} className="flex items-center gap-2 rounded-lg bg-success/5 px-3 py-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success/20 text-success text-[10px]">{"\u2713"}</span>
              <span className="text-sm text-primary">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Audit with Business DAG */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6 min-w-0">
        {(businessNodes.length > 0 || dagLoading) ? (
          <AuditBusinessDag
            nodes={businessNodes}
            loading={dagLoading}
            fromCache={fromCache}
            isCacheValid={isCacheValid}
            traceId={traceId}
            onForceRerun={() => runAuditCheck(true)}
            onJumpToStep={onJumpToStep}
          />
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-primary">AI 质量审核</h3>
                <p className="text-xs text-ink/50">基于知识库和规则对任务配置进行多维度评估</p>
              </div>
              <button onClick={() => runAuditCheck(false)} disabled={dagLoading} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent/90 disabled:opacity-50">
                {dagLoading ? "审核中…" : "开始审核"}
              </button>
            </div>
            {dagLoading && (
              <div className="py-8 flex flex-col items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                <p className="text-sm text-ink/50">AI 正在从多个维度评估您的任务配置…</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Developer Trace Toggle */}
      {traceNodes.length > 0 && (
        <div className="rounded-2xl border border-primary/10 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-primary">开发者视图</h3>
              <p className="text-[10px] text-ink/40 font-mono">traceId: {traceId}</p>
            </div>
            <button onClick={() => setShowDevTrace(!showDevTrace)} className="text-xs text-accent font-bold hover:underline">
              {showDevTrace ? "收起" : "展开 Agent Trace"}
            </button>
          </div>
          {showDevTrace && (
            <div className="space-y-2">
              {traceNodes.map(node => (
                <div key={node.id} className="rounded-lg border border-primary/10 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="bg-purple-50 text-purple-700 rounded px-1.5 py-0.5 text-[10px] font-mono">{node.type}</span>
                    <span className="font-bold text-primary">{node.title}</span>
                    <span className="ml-auto text-ink/30 font-mono">{node.durationMs}ms</span>
                    <span className={`h-2 w-2 rounded-full ${node.status === "success" ? "bg-success" : "bg-warning"}`} />
                  </div>
                  {node.rag && Boolean((node.rag as Record<string, unknown>).hasContent) && (
                    <p className="mt-1 text-[10px] text-emerald-600">RAG: 已召回知识</p>
                  )}
                  {node.skill && Boolean((node.skill as Record<string, unknown>).used) && (
                    <p className="mt-1 text-[10px] text-orange-600">Skills: {((node.skill as Record<string, unknown>).skills as string[] || []).join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task Package Quick Preview */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-primary">任务包预览</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => { const pkg = JSON.stringify({ taskId: config.taskId, title: config.taskName, instruction: config.instruction, schema: { components: config.schemaComponents }, rubric: { dimensions: config.rubricDimensions, rules: config.rubricRules }, assignmentPolicy: config.assignmentPolicy, agentPolicy: config.agentPolicy, sampleItemCount: config.sampleData.length, sampleData: config.sampleData }, null, 2); const b = new Blob([pkg], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `task-${config.taskId}.json`; a.click(); }} className="rounded-lg border border-accent/30 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/5">导出 JSON</button>
            <button onClick={() => { const csv = exportToCsv(config); const b = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `task-${config.taskId}.csv`; a.click(); }} className="rounded-lg border border-accent/30 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/5">导出 CSV</button>
            <button onClick={() => { navigator.clipboard.writeText(JSON.stringify({ taskId: config.taskId, title: config.taskName, instruction: config.instruction, schema: { components: config.schemaComponents }, rubric: { dimensions: config.rubricDimensions, rules: config.rubricRules } }, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface/50">{copied ? "已复制" : "复制"}</button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="标注组件" value={`${config.schemaComponents.length} 个`} />
          <SummaryItem label="质检规则" value={`${config.rubricRules.length} 条`} />
          <SummaryItem label="样例数据" value={`${config.sampleData.length} 条`} />
          <SummaryItem label="分配模式" value={config.assignmentPolicy.mode === "auto_claim" ? "自动领取" : "手动指派"} />
        </div>
        <p className="mt-3 text-xs text-ink/40">发布后，B/C 模块通过 API 获取完整任务包进行标注和审核</p>
      </div>

      {/* Publish Gate Warning */}
      {!canPublish && dagResult && !dagResult.allPassed && (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm font-bold text-warning">AI 审核未完全通过</p>
          <p className="mt-1 text-xs text-ink/60">建议根据上方审核意见优化配置后重新审核，或确认无需修改后强制发布。</p>
        </div>
      )}
    </div>
  );
}

function exportToCsv(config: TaskConfig): string {
  if (config.sampleData.length === 0) return "";
  const headers = Object.keys(config.sampleData[0]);
  const rows = config.sampleData.map(row => headers.map(h => {
    const val = row[h];
    const str = typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  }).join(","));
  return [headers.join(","), ...rows].join("\n");
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface/60 px-4 py-3">
      <p className="text-xs font-bold text-ink/40">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-primary">{value}</p>
    </div>
  );
}
