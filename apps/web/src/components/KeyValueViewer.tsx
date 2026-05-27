"use client";

import { useState } from "react";

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
        const expanded = expandedKeys.has(key);
        const display = isLong && !expanded ? text.slice(0, maxTextLen) + "…" : text;
        return (
          <div key={key} className="rounded-lg bg-white/80 px-2.5 py-1.5">
            <dt className="font-bold text-primary">{key}</dt>
            <dd className="text-ink/70 whitespace-pre-wrap break-words mt-0.5">{display}</dd>
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
