"use client";

import { useState } from "react";

export interface Tab {
  key: string;
  label: string;
  count?: number;
}

export function SubTabs({
  tabs,
  defaultTab,
  children
}: {
  tabs: Tab[];
  defaultTab?: string;
  children: (activeTab: string) => React.ReactNode;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key ?? "");

  return (
    <div className="space-y-5">
      <nav className="flex gap-1 rounded-2xl border border-primary/10 bg-surface p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              active === tab.key
                ? "bg-white text-primary shadow-sm"
                : "text-ink/50 hover:text-primary"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  active === tab.key ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary/60"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
      {children(active)}
    </div>
  );
}

export function SearchFilter({
  placeholder,
  value,
  onChange
}: {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <circle cx={11} cy={11} r={8} />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-primary/15 bg-white py-2.5 pl-10 pr-4 text-sm text-primary placeholder:text-ink/40 focus:border-accent focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}
