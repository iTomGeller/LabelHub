"use client";

import { useState, useCallback } from "react";

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

const DEMO_SAMPLE_DATA = [
  { comment: "退款申请三天了还不到账，客服也没人回复。", orderId: "ORD-10001", channel: "mobile-app" },
  { comment: "质量很好下次还会购买，物流也快！", orderId: "ORD-10002", channel: "web" },
  { comment: "尺寸偏大，但质量还行，能接受", orderId: "ORD-10003", channel: "mini-program" },
  { comment: "客服回复很及时解决了我的问题", orderId: "ORD-10004", channel: "web" },
  { comment: "发错颜色了联系换货一直没处理", orderId: "ORD-10005", channel: "mobile-app" },
];

const DEMO_COMPONENTS: SchemaComponent[] = [
  { id: "raw_comment", type: "showItem", label: "原始评论", dataPath: "$.raw.comment", required: false, props: { template: "{{raw.comment}}" }, validation: [] },
  { id: "intent", type: "singleChoice", label: "主要意图", dataPath: "$.annotation.intent", required: true, props: { options: ["咨询", "投诉", "夸赞", "售后", "无关"] }, validation: [{ type: "required", message: "请选择主要意图" }] },
  { id: "issue_types", type: "multiChoice", label: "问题类型", dataPath: "$.annotation.issueTypes", required: true, props: { options: ["退款", "物流", "客服", "商品质量", "价格"], min: 1, max: 3 }, validation: [{ type: "required", message: "至少选择一个问题类型" }] },
  { id: "sentiment_tags", type: "tagSelect", label: "情绪标签", dataPath: "$.annotation.sentimentTags", required: false, props: { options: ["愤怒", "焦虑", "满意", "疑惑", "中性"], max: 3 }, validation: [] },
  { id: "reason", type: "longText", label: "判断理由", dataPath: "$.annotation.reason", required: true, props: { placeholder: "引用评论中的关键信息说明判断依据" }, validation: [{ type: "required", message: "请填写判断理由" }, { type: "minLength", value: 8, message: "判断理由至少 8 个字" }] },
  { id: "evidence_upload", type: "fileUpload", label: "证据截图", dataPath: "$.annotation.evidenceFiles", required: false, props: { accept: ["image/png", "image/jpeg"], maxFiles: 3 }, validation: [] },
];

const DEMO_RULES: RubricRule[] = [
  { ruleId: "R1", description: "主要意图必须能从原始评论中直接找到依据", severity: "high", appliesTo: ["intent", "reason"], positiveExamples: ["评论提到退款失败，标注为售后并说明退款上下文"], negativeExamples: ["评论只表达满意，但标注为投诉"], allowAgentAutoPass: true },
  { ruleId: "R2", description: "判断理由必须引用评论中的关键词，不能只写结论", severity: "medium", appliesTo: ["reason"], positiveExamples: ["因为用户说'一直不到账'，所以归为售后"], negativeExamples: ["原因写'就是售后'"], allowAgentAutoPass: false },
  { ruleId: "R3", description: "多选问题类型时每项须与评论内容对应", severity: "medium", appliesTo: ["issue_types"], positiveExamples: ["评论涉及退款和客服不回复，选择'退款'和'客服'"], negativeExamples: ["随意多选不相关类型"], allowAgentAutoPass: true },
];

const DEMO_CONFIG: TaskConfig = {
  taskId: `task_${Date.now()}`,
  taskName: "电商评论意图分类",
  instruction: "根据电商用户评论判断主要意图（咨询/投诉/夸赞/售后/无关），标注问题类型和情绪标签，并给出判断依据。",
  sampleData: DEMO_SAMPLE_DATA,
  schemaComponents: DEMO_COMPONENTS,
  rubricRules: DEMO_RULES,
  rubricDimensions: ["相关性", "准确性", "格式合规", "安全性"],
  assignmentPolicy: { mode: "auto_claim", replicasPerItem: 1, deadlineHours: 24, quotaPerLabeler: 50 },
  agentPolicy: { precheckEnabled: true, confidenceThreshold: 0.8, modelPreference: "deepseek-chat", promptTemplateVersionId: "auto_v1" },
  rationale: "基于电商评论数据，配置了意图分类（单选）、问题类型（多选）、情绪标签和判断理由，覆盖典型标注场景。",
};

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

export function TaskStepper() {
  const [step, setStep] = useState<StepKey>("upload");
  const [config, setConfig] = useState<TaskConfig>(DEMO_CONFIG);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
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
      const res = await fetch("/agent-api/agents/generate-task-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: config.taskId,
          taskName: config.taskName || "未命名标注任务",
          instruction: config.instruction || "根据数据推断标注需求",
          sampleData: config.sampleData.slice(0, 5),
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
      setStep("template");
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
      publishedAt: new Date().toISOString(),
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
          <button onClick={() => { setPublished(false); setConfig({ ...DEMO_CONFIG, taskId: `task_${Date.now()}` }); setStep("upload"); }} className="rounded-xl border border-primary/20 px-5 py-2.5 text-sm font-bold text-primary hover:border-accent">新建任务</button>
          <a href="/?view=list" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90">查看任务列表</a>
        </div>
      </div>
    );
  }

  const checks = getPublishChecks(config);
  const allPassed = checks.every((c) => c.ok);

  return (
    <div className="space-y-6">
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
      {step === "publish" && <StepPublish config={config} allPassed={allPassed} checks={checks} onPublish={handlePublish} />}

      <div className="flex items-center justify-between">
        <button onClick={goPrev} disabled={currentIdx === 0} className={`rounded-xl border border-primary/20 px-5 py-2.5 text-sm font-bold ${currentIdx === 0 ? "cursor-not-allowed text-ink/30" : "text-primary hover:border-accent"}`}>上一步</button>
        {currentIdx < STEPS.length - 1 ? (
          <button onClick={goNext} className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-accent/90">下一步</button>
        ) : (
          <button onClick={handlePublish} disabled={!allPassed} className={`rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-sm ${allPassed ? "bg-success hover:bg-success/90" : "bg-ink/20 cursor-not-allowed"}`}>
            {allPassed ? "发布任务" : `还有 ${checks.filter(c => !c.ok).length} 项未通过`}
          </button>
        )}
      </div>
    </div>
  );
}

function getPublishChecks(config: TaskConfig) {
  return [
    { label: "任务名称已填写", ok: config.taskName.trim().length > 0 },
    { label: "任务说明已填写", ok: config.instruction.trim().length > 0 },
    { label: "样例数据已导入", ok: config.sampleData.length > 0 },
    { label: "标注模板已配置", ok: config.schemaComponents.length > 0 },
    { label: "质检规则已配置", ok: config.rubricRules.length > 0 },
    { label: "评分维度 ≥ 4", ok: config.rubricDimensions.length >= 4 },
    { label: "分配策略已设置", ok: config.assignmentPolicy.mode === "auto_claim" },
    { label: "AI 预审已启用", ok: config.agentPolicy.precheckEnabled },
  ];
}

/* ─── Step 1: Upload Data ─── */

function StepUpload({ config, setConfig, onAiGenerate, loading }: { config: TaskConfig; setConfig: React.Dispatch<React.SetStateAction<TaskConfig>>; onAiGenerate: () => void; loading: boolean }) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

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

      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <h3 className="text-lg font-bold text-primary">上传标注数据</h3>
        <p className="mt-1 text-sm text-ink/60">支持 JSON / JSONL / CSV 文件或直接粘贴</p>
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

      {config.sampleData.length > 0 && <DataPreviewTable data={config.sampleData} />}

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

function DataPreviewTable({ data }: { data: Record<string, unknown>[] }) {
  const fields = Object.keys(data[0] || {});
  const preview = data.slice(0, 5);

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-primary">数据预览</h3>
          <p className="text-xs text-ink/50">共 {data.length} 条数据，{fields.length} 个字段</p>
        </div>
        <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">数据就绪</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-primary/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface/80">
              {fields.map((f) => <th key={f} className="px-3 py-2 text-left text-xs font-bold text-ink/60 whitespace-nowrap">{f}</th>)}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i} className="border-t border-primary/5">
                {fields.map((f) => <td key={f} className="px-3 py-2 text-xs text-ink/80 max-w-[200px] truncate">{String(row[f] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 5 && <p className="mt-2 text-xs text-ink/40 text-center">显示前 5 条，共 {data.length} 条</p>}
    </div>
  );
}

/* ─── Step 2: Template Builder ─── */

function StepTemplate({ config, setConfig }: { config: TaskConfig; setConfig: React.Dispatch<React.SetStateAction<TaskConfig>> }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(config.schemaComponents.length > 0 ? 0 : null);
  const [showPresets, setShowPresets] = useState(false);
  const selected = selectedIdx !== null ? config.schemaComponents[selectedIdx] : null;

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

function StepPublish({ config, allPassed, checks, onPublish }: { config: TaskConfig; allPassed: boolean; checks: { label: string; ok: boolean }[]; onPublish: () => void }) {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const taskPackageJson = {
    taskId: config.taskId,
    title: config.taskName,
    instruction: config.instruction,
    schema: { components: config.schemaComponents, frozen: allPassed },
    rubric: { dimensions: config.rubricDimensions, rules: config.rubricRules },
    assignmentPolicy: config.assignmentPolicy,
    agentPolicy: config.agentPolicy,
    sampleItemCount: config.sampleData.length,
  };

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(taskPackageJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <h2 className="text-xl font-bold text-primary">确认发布</h2>
        <p className="mt-1 text-sm text-ink/60">审核配置摘要，确认无误后发布。发布后 B/C 即可消费此任务。</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <SummaryItem label="任务名称" value={config.taskName || "未填写"} />
          <SummaryItem label="标注组件" value={`${config.schemaComponents.length} 个`} />
          <SummaryItem label="样例数据" value={`${config.sampleData.length} 条`} />
          <SummaryItem label="质检规则" value={`${config.rubricRules.length} 条`} />
          <SummaryItem label="评分维度" value={config.rubricDimensions.join("、") || "未配置"} />
          <SummaryItem label="分配策略" value={config.assignmentPolicy.mode === "auto_claim" ? "自动领取" : "手动指派"} />
          <SummaryItem label="领取截止" value={`${config.assignmentPolicy.deadlineHours} 小时`} />
          <SummaryItem label="AI 预审阈值" value={`${Math.round(config.agentPolicy.confidenceThreshold * 100)}%`} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setShowJson(!showJson)} className="text-xs font-bold text-accent hover:underline">{showJson ? "收起 JSON" : "查看任务包 JSON"}</button>
          {showJson && <button onClick={copyJson} className="text-xs font-bold text-primary hover:text-accent">{copied ? "已复制" : "复制 JSON"}</button>}
        </div>
        {showJson && (
          <pre className="mt-3 max-h-[300px] overflow-auto rounded-xl bg-primary p-4 text-xs leading-5 text-white/90">{JSON.stringify(taskPackageJson, null, 2)}</pre>
        )}
      </div>

      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-primary">发布检查</h3>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${allPassed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{checks.filter(c => c.ok).length}/{checks.length} 通过</span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 rounded-lg bg-surface/60 px-3 py-2">
              <span className={`h-2 w-2 rounded-full ${c.ok ? "bg-success" : "bg-danger"}`} />
              <span className={`text-sm ${c.ok ? "text-primary" : "text-danger font-bold"}`}>{c.label}</span>
            </div>
          ))}
        </div>
        {!allPassed && <p className="mt-3 text-xs text-danger">请回到前面的步骤补全未通过项后再发布</p>}
      </div>

      <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
        <h3 className="font-bold text-primary">与 B/C 模块的交互</h3>
        <p className="mt-1 text-sm text-ink/60">发布后，B/C 通过 <code className="rounded bg-white px-1.5 py-0.5 text-xs font-mono">GET /api/tasks/{"{id}"}/package</code> 获取任务包。</p>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface/60 px-4 py-3">
      <p className="text-xs font-bold text-ink/40">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-primary">{value}</p>
    </div>
  );
}
