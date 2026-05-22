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
  validation: Array<{ type: string; value: unknown; message: string }>;
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

const emptyConfig: TaskConfig = {
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

export function TaskStepper() {
  const [step, setStep] = useState<StepKey>("upload");
  const [config, setConfig] = useState<TaskConfig>(emptyConfig);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentIdx = STEPS.findIndex((s) => s.key === step);

  function goNext() {
    if (currentIdx < STEPS.length - 1) setStep(STEPS[currentIdx + 1].key);
  }
  function goPrev() {
    if (currentIdx > 0) setStep(STEPS[currentIdx - 1].key);
  }
  function jumpTo(key: StepKey) {
    setStep(key);
  }

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
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      setConfig((prev) => ({
        ...prev,
        schemaComponents: data.schemaComponents || [],
        rubricRules: data.rubricRules || [],
        rubricDimensions: data.rubricDimensions || [],
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

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="rounded-2xl border border-primary/10 bg-white p-5">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => jumpTo(s.key)}
              className="flex flex-1 items-center gap-3"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  i < currentIdx
                    ? "bg-success text-white"
                    : i === currentIdx
                    ? "bg-accent text-white"
                    : "bg-surface text-ink/40"
                }`}
              >
                {i < currentIdx ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.num
                )}
              </div>
              <span
                className={`text-sm font-bold ${
                  i === currentIdx ? "text-primary" : "text-ink/40"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-px flex-1 ${i < currentIdx ? "bg-success" : "bg-primary/10"}`} />
              )}
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

      {/* Step Content */}
      {step === "upload" && (
        <StepUpload
          config={config}
          setConfig={setConfig}
          onAiGenerate={handleAiGenerate}
          loading={loading}
        />
      )}
      {step === "template" && <StepTemplate config={config} setConfig={setConfig} />}
      {step === "rules" && <StepRules config={config} setConfig={setConfig} />}
      {step === "publish" && <StepPublish config={config} />}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className={`rounded-xl border border-primary/20 px-5 py-2.5 text-sm font-bold ${
            currentIdx === 0 ? "cursor-not-allowed text-ink/30" : "text-primary hover:border-accent"
          }`}
        >
          上一步
        </button>
        {currentIdx < STEPS.length - 1 ? (
          <button
            onClick={goNext}
            className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-accent/90"
          >
            下一步
          </button>
        ) : (
          <button className="rounded-xl bg-success px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-success/90">
            发布任务
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Step 1: Upload Data ─── */

function StepUpload({
  config,
  setConfig,
  onAiGenerate,
  loading,
}: {
  config: TaskConfig;
  setConfig: React.Dispatch<React.SetStateAction<TaskConfig>>;
  onAiGenerate: () => void;
  loading: boolean;
}) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  function handlePasteImport() {
    try {
      const lines = pasteText.trim().split("\n").filter(Boolean);
      const parsed = lines.map((line) => JSON.parse(line));
      setConfig((prev) => ({ ...prev, sampleData: parsed }));
      setPasteMode(false);
    } catch {
      try {
        const parsed = JSON.parse(pasteText);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        setConfig((prev) => ({ ...prev, sampleData: arr }));
        setPasteMode(false);
      } catch {
        alert("无法解析 JSON，请检查格式");
      }
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      try {
        const lines = text.trim().split("\n").filter(Boolean);
        if (lines.length === 1) {
          const parsed = JSON.parse(lines[0]);
          setConfig((prev) => ({ ...prev, sampleData: Array.isArray(parsed) ? parsed : [parsed] }));
        } else {
          const parsed = lines.map((line) => JSON.parse(line));
          setConfig((prev) => ({ ...prev, sampleData: parsed }));
        }
      } catch {
        alert("文件解析失败，请确保是 JSON/JSONL 格式");
      }
    };
    reader.readAsText(file);
  }

  const fields = config.sampleData.length > 0 ? Object.entries(config.sampleData[0]) : [];

  return (
    <div className="space-y-5">
      {/* Task Basic Info */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6 space-y-4">
        <h2 className="text-xl font-bold text-primary">任务基本信息</h2>
        <div>
          <label className="block text-sm font-bold text-ink/60 mb-1">任务名称</label>
          <input
            type="text"
            value={config.taskName}
            onChange={(e) => setConfig((prev) => ({ ...prev, taskName: e.target.value }))}
            placeholder="例：电商评论意图分类"
            className="w-full rounded-xl border border-primary/15 px-4 py-2.5 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-ink/60 mb-1">任务说明（AI 会据此生成配置）</label>
          <textarea
            value={config.instruction}
            onChange={(e) => setConfig((prev) => ({ ...prev, instruction: e.target.value }))}
            placeholder="描述你的标注需求，例如：根据电商用户评论判断主要意图（咨询/投诉/夸赞/售后），并给出判断依据…"
            rows={3}
            className="w-full rounded-xl border border-primary/15 px-4 py-2.5 text-sm focus:border-accent focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* Upload Section */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <h3 className="text-lg font-bold text-primary">上传标注数据</h3>
        <p className="mt-1 text-sm text-ink/60">支持 JSON/JSONL 文件或直接粘贴数据</p>

        <div className="mt-4 flex gap-3">
          <label className="flex-1 cursor-pointer rounded-xl border-2 border-dashed border-primary/20 bg-surface p-6 text-center hover:border-accent transition">
            <input type="file" accept=".json,.jsonl" className="hidden" onChange={handleFileUpload} />
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="mt-2 text-sm font-bold text-primary">选择文件</p>
            <p className="text-xs text-ink/50">JSON / JSONL</p>
          </label>

          <button
            onClick={() => setPasteMode(!pasteMode)}
            className="flex-1 rounded-xl border-2 border-dashed border-primary/20 bg-surface p-6 text-center hover:border-accent transition"
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3a2.25 2.25 0 0 0-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
              </svg>
            </div>
            <p className="mt-2 text-sm font-bold text-primary">粘贴数据</p>
            <p className="text-xs text-ink/50">JSON 数组 / JSONL</p>
          </button>
        </div>

        {pasteMode && (
          <div className="mt-4 space-y-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'[{"comment": "退款三天不到账", "orderId": "ORD-001"}]\n或每行一个 JSON 对象'}
              rows={5}
              className="w-full rounded-xl border border-primary/15 px-4 py-3 text-sm font-mono focus:border-accent focus:outline-none resize-none"
            />
            <button
              onClick={handlePasteImport}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
            >
              导入数据
            </button>
          </div>
        )}
      </div>

      {/* Detected fields */}
      {fields.length > 0 && (
        <div className="rounded-2xl border border-primary/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-primary">已检测到 {fields.length} 个字段</h3>
              <p className="mt-0.5 text-sm text-ink/50">共 {config.sampleData.length} 条数据</p>
            </div>
            <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
              数据就绪
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {fields.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-xl bg-surface/70 px-4 py-2.5">
                <span className="font-mono text-sm font-bold text-primary">{key}</span>
                <span className="text-sm text-ink/50">{typeof value === "string" ? `"${(value as string).slice(0, 30)}..."` : typeof value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI One-Click */}
      <div className="rounded-2xl border-2 border-accent/30 bg-accent/5 p-6 text-center">
        <h3 className="text-lg font-bold text-primary">AI 一键生成任务配置</h3>
        <p className="mt-1 text-sm text-ink/60">
          AI 将根据任务说明和样例数据，自动生成标注模板、质检规则和分配策略。
        </p>
        <button
          onClick={onAiGenerate}
          disabled={loading}
          className={`mt-4 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition ${
            loading ? "bg-accent/50 cursor-wait" : "bg-accent hover:bg-accent/90"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              AI 正在生成…
            </span>
          ) : (
            "AI 一键配置 →"
          )}
        </button>
        {config.rationale && (
          <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-xs text-ink/70 text-left">
            <span className="font-bold text-accent">AI 说明：</span>{config.rationale}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Step 2: Template Builder ─── */

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

function StepTemplate({ config, setConfig }: { config: TaskConfig; setConfig: React.Dispatch<React.SetStateAction<TaskConfig>> }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(config.schemaComponents.length > 0 ? 0 : null);
  const selected = selectedIdx !== null ? config.schemaComponents[selectedIdx] : null;

  function updateComponent(idx: number, patch: Partial<SchemaComponent>) {
    setConfig((prev) => ({
      ...prev,
      schemaComponents: prev.schemaComponents.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  }

  function removeComponent(idx: number) {
    setConfig((prev) => ({
      ...prev,
      schemaComponents: prev.schemaComponents.filter((_, i) => i !== idx),
    }));
    setSelectedIdx(null);
  }

  function addComponent() {
    const newComp: SchemaComponent = {
      id: `comp_${Date.now()}`,
      type: "shortText",
      label: "新组件",
      dataPath: `$.annotation.new_${Date.now()}`,
      required: false,
      props: {},
      validation: [],
    };
    setConfig((prev) => ({
      ...prev,
      schemaComponents: [...prev.schemaComponents, newComp],
    }));
    setSelectedIdx(config.schemaComponents.length);
  }

  return (
    <div className="rounded-2xl border border-primary/10 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-primary/10 px-5 py-4">
        <div>
          <h2 className="text-xl font-bold text-primary">配置标注模板</h2>
          <p className="text-sm text-ink/50">点击组件编辑属性，拖拽调整顺序。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            {config.schemaComponents.length} 个组件
          </span>
          <button
            onClick={addComponent}
            className="rounded-lg border border-accent px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/5"
          >
            + 添加组件
          </button>
        </div>
      </div>

      {config.schemaComponents.length === 0 ? (
        <div className="p-10 text-center text-ink/40">
          <p className="text-lg font-bold">暂无组件</p>
          <p className="mt-1 text-sm">返回上一步使用 AI 生成，或手动添加组件。</p>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_300px]">
          {/* Component List */}
          <div className="min-h-[400px] bg-surface/20 p-4 space-y-2">
            {config.schemaComponents.map((c, i) => (
              <div
                key={c.id}
                onClick={() => setSelectedIdx(i)}
                className={`cursor-pointer rounded-xl border bg-white px-4 py-3 transition ${
                  selectedIdx === i ? "border-accent shadow-sm" : "border-primary/10 hover:border-accent/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                      {componentTypeLabels[c.type] || c.type}
                    </span>
                    <span className="text-sm font-bold text-primary">{c.label}</span>
                    {c.required && <span className="text-danger text-xs">*</span>}
                  </div>
                  <span className="font-mono text-[10px] text-ink/40">{c.dataPath}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Property Editor */}
          <aside className="border-l border-primary/10 p-4 overflow-y-auto max-h-[500px]">
            <p className="text-xs font-bold text-ink/40 mb-3">属性编辑</p>
            {selected && selectedIdx !== null ? (
              <div className="space-y-3">
                <EditField
                  label="名称"
                  value={selected.label}
                  onChange={(v) => updateComponent(selectedIdx, { label: v })}
                />
                <EditField
                  label="数据路径"
                  value={selected.dataPath}
                  onChange={(v) => updateComponent(selectedIdx, { dataPath: v })}
                  mono
                />
                <div>
                  <label className="block text-xs font-bold text-ink/40 mb-1">类型</label>
                  <select
                    value={selected.type}
                    onChange={(e) => updateComponent(selectedIdx, { type: e.target.value })}
                    className="w-full rounded-lg border border-primary/15 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
                  >
                    {Object.entries(componentTypeLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.required}
                    onChange={(e) => updateComponent(selectedIdx, { required: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-primary">必填</span>
                </div>
                {selected.validation.length > 0 && (
                  <div className="rounded-lg bg-surface p-2.5">
                    <p className="text-xs font-bold text-ink/50">校验规则 ({selected.validation.length})</p>
                    {selected.validation.map((v, i) => (
                      <p key={i} className="mt-1 text-xs text-ink/60">{v.type}: {v.message}</p>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => removeComponent(selectedIdx)}
                  className="mt-2 w-full rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger/5"
                >
                  删除此组件
                </button>
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

function EditField({ label, value, onChange, mono }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-bold text-ink/40 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-primary/15 px-3 py-1.5 text-sm focus:border-accent focus:outline-none ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

/* ─── Step 3: Rubric Rules ─── */

function StepRules({ config, setConfig }: { config: TaskConfig; setConfig: React.Dispatch<React.SetStateAction<TaskConfig>> }) {
  function updateRule(idx: number, patch: Partial<RubricRule>) {
    setConfig((prev) => ({
      ...prev,
      rubricRules: prev.rubricRules.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  }

  function addRule() {
    const newRule: RubricRule = {
      ruleId: `R${config.rubricRules.length + 1}`,
      description: "",
      severity: "medium",
      appliesTo: [],
      positiveExamples: [],
      negativeExamples: [],
      allowAgentAutoPass: false,
    };
    setConfig((prev) => ({ ...prev, rubricRules: [...prev.rubricRules, newRule] }));
  }

  function removeRule(idx: number) {
    setConfig((prev) => ({
      ...prev,
      rubricRules: prev.rubricRules.filter((_, i) => i !== idx),
    }));
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary">质检规则</h2>
            <p className="mt-1 text-sm text-ink/60">编辑 AI 生成的规则或手动新增。</p>
          </div>
          <button
            onClick={addRule}
            className="rounded-lg border border-accent px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/5"
          >
            + 新增规则
          </button>
        </div>

        {/* Dimensions */}
        <div className="mt-5">
          <p className="text-sm font-bold text-primary">评分维度</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {config.rubricDimensions.map((d, i) => (
              <span key={i} className="rounded-full border border-accent/30 bg-accent/5 px-3 py-1.5 text-sm font-bold text-accent">
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Rules */}
        {config.rubricRules.length === 0 ? (
          <div className="mt-5 text-center text-ink/40 py-8">
            <p>暂无规则，请使用 AI 生成或手动添加。</p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {config.rubricRules.map((rule, idx) => (
              <div key={rule.ruleId} className="rounded-xl border border-primary/10 bg-surface/50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={rule.description}
                    onChange={(e) => updateRule(idx, { description: e.target.value })}
                    placeholder="规则描述"
                    className="flex-1 rounded-lg border border-primary/15 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
                  />
                  <select
                    value={rule.severity}
                    onChange={(e) => updateRule(idx, { severity: e.target.value })}
                    className="rounded-lg border border-primary/15 px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="critical">严重</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-ink/60">
                    <input
                      type="checkbox"
                      checked={rule.allowAgentAutoPass}
                      onChange={(e) => updateRule(idx, { allowAgentAutoPass: e.target.checked })}
                      className="rounded"
                    />
                    自动通过
                  </label>
                  <button
                    onClick={() => removeRule(idx)}
                    className="text-danger text-xs font-bold hover:underline"
                  >
                    删除
                  </button>
                </div>
                {rule.positiveExamples.length > 0 && (
                  <p className="text-xs text-success pl-1">正例：{rule.positiveExamples[0]}</p>
                )}
                {rule.negativeExamples.length > 0 && (
                  <p className="text-xs text-danger pl-1">负例：{rule.negativeExamples[0]}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 4: Publish ─── */

function StepPublish({ config }: { config: TaskConfig }) {
  const [showJson, setShowJson] = useState(false);

  const checks = [
    { label: "任务名称已填写", ok: config.taskName.trim().length > 0 },
    { label: "任务说明已填写", ok: config.instruction.trim().length > 0 },
    { label: "样例数据已导入", ok: config.sampleData.length > 0 },
    { label: "标注模板已配置", ok: config.schemaComponents.length > 0 },
    { label: "质检规则已配置", ok: config.rubricRules.length > 0 },
    { label: "评分维度 ≥ 4", ok: config.rubricDimensions.length >= 4 },
    { label: "分配策略已设置", ok: config.assignmentPolicy.mode === "auto_claim" },
    { label: "AI 预审已启用", ok: config.agentPolicy.precheckEnabled },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const allPassed = passed === checks.length;

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

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <h2 className="text-xl font-bold text-primary">确认发布</h2>
        <p className="mt-1 text-sm text-ink/60">审核配置摘要，确认无误后发布。发布后 B（标注工作台）和 C（审核工作台）即可消费此任务。</p>

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

        <button
          onClick={() => setShowJson(!showJson)}
          className="mt-4 text-xs font-bold text-accent hover:underline"
        >
          {showJson ? "收起 JSON" : "查看任务包 JSON（B/C 消费接口）"}
        </button>
        {showJson && (
          <pre className="mt-3 max-h-[300px] overflow-auto rounded-xl bg-primary p-4 text-xs leading-5 text-white/90">
            {JSON.stringify(taskPackageJson, null, 2)}
          </pre>
        )}
      </div>

      {/* Publish Checks */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-primary">发布检查</h3>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${
            allPassed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          }`}>
            {passed}/{checks.length} 通过
          </span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 rounded-lg bg-surface/60 px-3 py-2">
              <span className={`h-2 w-2 rounded-full ${c.ok ? "bg-success" : "bg-danger"}`} />
              <span className={`text-sm ${c.ok ? "text-primary" : "text-danger font-bold"}`}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* B/C Contract Info */}
      <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
        <h3 className="font-bold text-primary">与 B/C 模块的交互</h3>
        <p className="mt-1 text-sm text-ink/60">
          发布后，B（标注工作台）通过 <code className="rounded bg-white px-1.5 py-0.5 text-xs font-mono">GET /api/tasks/{"{id}"}/package</code> 获取此任务包；
          C（审核工作台）通过同一接口获取 Rubric 和评分维度进行质检。
        </p>
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
