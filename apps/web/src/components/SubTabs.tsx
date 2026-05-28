"use client";

import { useEffect, useState } from "react";

export interface Tab {
  key: string;
  label: string;
  count?: number;
}

export function SubTabs({
  tabs,
  defaultTab,
  activeTab: controlledTab,
  onTabChange,
  children,
}: {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  children: (activeTab: string) => React.ReactNode;
}) {
  const [internalActive, setInternalActive] = useState(defaultTab ?? tabs[0]?.key ?? "");
  const isControlled = controlledTab !== undefined;
  const active = isControlled ? controlledTab : internalActive;

  useEffect(() => {
    if (isControlled && controlledTab && tabs.some((tab) => tab.key === controlledTab)) {
      setInternalActive(controlledTab);
    }
  }, [controlledTab, isControlled, tabs]);

  function handleSelect(tabKey: string) {
    setInternalActive(tabKey);
    onTabChange?.(tabKey);
  }

  return (
    <div className="space-y-5 min-w-0">
      <nav className="flex flex-wrap gap-1 rounded-2xl border border-primary/10 bg-surface p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleSelect(tab.key)}
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
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="relative min-w-0">
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
