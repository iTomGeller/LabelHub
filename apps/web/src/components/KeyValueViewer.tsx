"use client";

import { useState } from "react";
import { agentLabel, nodeLabel, toolLabel } from "@/lib/diagnosticLabels";

const KEY_ZH: Record<string, string> = {
  agent: "智能体",
  nodeKey: "业务节点",
  businessNode: "业务维度",
  objective: "审核目标",
  systemContext: "系统上下文",
  userInput: "用户输入",
  constraints: "约束条件",
  taskName: "任务名称",
  instructionPreview: "任务说明摘要",
  query: "检索查询",
  category: "知识分类",
  topChunks: "命中片段",
  emptyReason: "空召回原因",
  hasContent: "是否有内容",
  checkTarget: "检查对象",
  stdoutPreview: "输出摘要",
  server: "MCP 服务",
  tool: "工具",
  status: "状态",
  durationMs: "耗时(ms)",
  findingCount: "发现数",
  conclusion: "结论",
  stepCount: "决策步数",
  reason: "原因",
  taskId: "任务 ID",
  sequence: "执行序号",
  phase: "阶段",
  callKind: "调用类型",
  inputPreview: "输入预览",
  outputPreview: "输出预览",
  resultSummary: "结果摘要",
  whyCalled: "调用原因",
  degradeReason: "降级原因",
  exitCode: "退出码",
  knowledge_base: "知识库",
};

function labelForKey(key: string): string {
  if (KEY_ZH[key]) return KEY_ZH[key];
  if (key.includes("_")) {
    const mapped = agentLabel(key);
    if (mapped !== key.replace(/_/g, " ")) return mapped;
  }
  return key.replace(/_/g, " ");
}

function renderValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function KeyValueViewer({ data, maxTextLen = 160 }: { data?: Record<string, unknown> | null; maxTextLen?: number }) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  if (!data || Object.keys(data).length === 0) {
    return <p className="text-xs text-ink/40">无数据</p>;
  }

  return (
    <dl className="space-y-1.5 text-xs">
      {Object.entries(data).map(([key, value]) => {
        const text = renderValue(value);
        const isLong = text.length > maxTextLen;
        const isArray = Array.isArray(value);
        const expanded = expandedKeys.has(key);
        const display = isLong && !expanded ? text.slice(0, maxTextLen) + "…" : text;
        const label = labelForKey(key);
        const displayLabel = key === "tool" && typeof value === "string" ? toolLabel(value) : label;

        return (
          <div key={key} className="rounded-lg bg-white/80 px-2.5 py-1.5">
            <dt className="font-bold text-primary">{displayLabel}</dt>
            {isArray && !expanded ? (
              <dd className="text-ink/70 mt-0.5">
                <button
                  type="button"
                  onClick={() => setExpandedKeys((p) => new Set(p).add(key))}
                  className="text-[10px] font-bold text-accent hover:underline"
                >
                  展开 {value.length} 项
                </button>
              </dd>
            ) : (
              <dd className="text-ink/70 whitespace-pre-wrap break-words mt-0.5">{display}</dd>
            )}
            {isLong && (
              <button
                type="button"
                onClick={() => {
                  setExpandedKeys((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  });
                }}
                className="mt-1 text-[10px] font-bold text-accent hover:underline"
              >
                {expanded ? "收起" : "展开"}
              </button>
            )}
          </div>
        );
      })}
    </dl>
  );
}

export { labelForKey as keyLabelZh };
