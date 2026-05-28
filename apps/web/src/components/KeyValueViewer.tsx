"use client";

import { useState } from "react";
import { agentLabel, toolLabel } from "@/lib/diagnosticLabels";

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
  skillName: "技能名称",
  componentCount: "组件数量",
  ruleCount: "规则数量",
  sampleCount: "样例数量",
  hitCount: "命中数",
  charCount: "字符数",
  usedFallback: "跨分类兜底",
  severity: "严重级别",
  description: "描述",
  suggestion: "建议",
  findings: "检查发现",
};

function labelForKey(key: string): string {
  if (KEY_ZH[key]) return KEY_ZH[key];
  if (key.includes("_")) {
    const mapped = agentLabel(key);
    if (mapped !== key.replace(/_/g, " ")) return mapped;
  }
  return key.replace(/_/g, " ");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function FindingCards({ items }: { items: unknown[] }) {
  return (
    <ul className="space-y-1.5 mt-1">
      {items.slice(0, 8).map((item, i) => {
        if (isPlainObject(item)) {
          return (
            <li key={i} className="rounded-lg bg-surface/50 px-2 py-1.5 text-ink/70">
              {item.severity != null && <span className="font-bold text-warning mr-1">[{String(item.severity)}]</span>}
              {item.description != null && <span>{String(item.description)}</span>}
              {item.suggestion != null && String(item.suggestion) && (
                <p className="text-[10px] text-accent mt-0.5">建议：{String(item.suggestion)}</p>
              )}
            </li>
          );
        }
        return <li key={i} className="rounded-lg bg-surface/50 px-2 py-1.5">{String(item)}</li>;
      })}
      {items.length > 8 && <li className="text-[10px] text-ink/40">… 共 {items.length} 项</li>}
    </ul>
  );
}

function ValueNode({ value, depth = 0, maxTextLen = 160 }: { value: unknown; depth?: number; maxTextLen?: number }) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (value == null) return <span className="text-ink/40">—</span>;
  if (typeof value === "string") {
    const isLong = value.length > maxTextLen;
    const display = isLong && !expanded ? value.slice(0, maxTextLen) + "…" : value;
    return (
      <span className="text-ink/70 whitespace-pre-wrap break-words">
        {display}
        {isLong && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="ml-1 text-[10px] font-bold text-accent hover:underline">
            {expanded ? "收起" : "展开"}
          </button>
        )}
      </span>
    );
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="text-ink/70">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-ink/40">空列表</span>;
    if (!expanded) {
      return (
        <button type="button" onClick={() => setExpanded(true)} className="text-[10px] font-bold text-accent hover:underline">
          展开 {value.length} 项
        </button>
      );
    }
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return (
        <ul className="space-y-0.5 mt-0.5">
          {value.slice(0, 6).map((v, i) => (
            <li key={i} className="text-ink/70">· {String(v)}</li>
          ))}
          {value.length > 6 && <li className="text-[10px] text-ink/40">… 共 {value.length} 项</li>}
        </ul>
      );
    }
    return <FindingCards items={value} />;
  }
  if (isPlainObject(value)) {
    if (!expanded) {
      return (
        <button type="button" onClick={() => setExpanded(true)} className="text-[10px] font-bold text-accent hover:underline">
          展开对象 ({Object.keys(value).length} 字段)
        </button>
      );
    }
    return (
      <dl className={`space-y-1 ${depth > 0 ? "mt-1 pl-2 border-l border-primary/10" : ""}`}>
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] font-bold text-ink/50">{labelForKey(k)}</dt>
            <dd className="mt-0.5"><ValueNode value={v} depth={depth + 1} maxTextLen={maxTextLen} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="text-ink/70">{String(value)}</span>;
}

export function KeyValueViewer({ data, maxTextLen = 160 }: { data?: Record<string, unknown> | null; maxTextLen?: number }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-xs text-ink/40">无数据</p>;
  }

  return (
    <dl className="space-y-1.5 text-xs">
      {Object.entries(data).map(([key, value]) => {
        const label = labelForKey(key);
        const displayLabel = key === "tool" && typeof value === "string" ? toolLabel(value) : label;
        const isFindings = key === "findings" && Array.isArray(value);
        const isTopChunks = key === "topChunks" && Array.isArray(value);

        return (
          <div key={key} className="rounded-lg bg-white/80 px-2.5 py-1.5">
            <dt className="font-bold text-primary">{displayLabel}</dt>
            <dd className="mt-0.5">
              {isFindings || isTopChunks ? (
                <FindingCards items={value as unknown[]} />
              ) : (
                <ValueNode value={value} maxTextLen={maxTextLen} />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export { labelForKey as keyLabelZh };
