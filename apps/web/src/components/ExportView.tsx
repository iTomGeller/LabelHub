"use client";

import { SubTabs, SearchFilter } from "./SubTabs";
import { useState } from "react";

const TABS = [
  { key: "mapping", label: "字段映射" },
  { key: "history", label: "导出历史", count: 5 },
  { key: "settings", label: "导出设置" }
];

const mockExports = [
  { id: "exp_001", format: "JSONL", records: 1000, status: "完成", time: "2026-05-21 14:35", size: "2.4MB" },
  { id: "exp_002", format: "CSV", records: 1000, status: "完成", time: "2026-05-21 13:20", size: "1.8MB" },
  { id: "exp_003", format: "JSONL", records: 500, status: "完成", time: "2026-05-20 16:45", size: "1.1MB" },
  { id: "exp_004", format: "Excel", records: 800, status: "失败", time: "2026-05-20 14:10", size: "-" },
  { id: "exp_005", format: "JSONL", records: 200, status: "进行中", time: "2026-05-21 14:40", size: "-" }
];

export function ExportView() {
  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-primary/10 bg-white p-5 shadow-panel">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">导出中心</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-primary">数据导出管理</h1>
        <p className="mt-1 text-sm text-ink/60">为 C 的导出模块预留入口，负责人查看字段映射和导出历史。</p>
      </header>

      <SubTabs tabs={TABS} defaultTab="mapping">
        {(tab) => {
          switch (tab) {
            case "mapping":
              return <MappingTab />;
            case "history":
              return <HistoryTab />;
            case "settings":
              return <SettingsTab />;
            default:
              return null;
          }
        }}
      </SubTabs>
    </section>
  );
}

function MappingTab() {
  const mappings = [
    { source: "annotation.sentiment", target: "label", type: "string" },
    { source: "annotation.tags", target: "tags", type: "array" },
    { source: "raw.comment", target: "text", type: "string" },
    { source: "raw.orderId", target: "order_id", type: "string" },
    { source: "metadata.annotator", target: "worker_id", type: "string" },
    { source: "metadata.duration", target: "time_spent_ms", type: "number" }
  ];

  const [search, setSearch] = useState("");
  const filtered = mappings.filter(
    (m) => !search || m.source.includes(search) || m.target.includes(search)
  );

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primary">字段映射配置</h2>
          <p className="mt-1 text-sm text-ink/60">定义标注结果到导出格式的字段映射关系。</p>
        </div>
        <div className="w-64">
          <SearchFilter placeholder="搜索字段名..." value={search} onChange={setSearch} />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-primary/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary text-white">
            <tr>
              <th className="px-4 py-3 font-bold">源路径</th>
              <th className="px-4 py-3 font-bold">导出字段</th>
              <th className="px-4 py-3 font-bold">类型</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.source} className="border-b border-primary/10 last:border-b-0">
                <td className="px-4 py-3 font-mono text-xs text-primary">{m.source}</td>
                <td className="px-4 py-3 font-semibold text-primary">{m.target}</td>
                <td className="px-4 py-3">
                  <span className="rounded-lg bg-accent/10 px-2 py-1 text-xs font-bold text-accent">{m.type}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-ink/40">没有匹配的映射</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryTab() {
  const [search, setSearch] = useState("");
  const filtered = mockExports.filter(
    (e) => !search || e.id.includes(search) || e.format.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primary">导出历史</h2>
          <p className="mt-1 text-sm text-ink/60">查看所有导出任务及其状态。</p>
        </div>
        <div className="w-64">
          <SearchFilter placeholder="搜索 ID 或格式..." value={search} onChange={setSearch} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-xl border border-primary/10 bg-surface/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-primary">{e.id}</span>
              <span className="rounded-lg bg-accent/10 px-2 py-1 text-xs font-bold text-accent">{e.format}</span>
              <span className="text-sm text-ink/60">{e.records} 条</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink/40">{e.size}</span>
              <span className="text-xs text-ink/40">{e.time}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                e.status === "完成" ? "bg-success/10 text-success" :
                e.status === "失败" ? "bg-danger/10 text-danger" :
                "bg-warning/10 text-warning"
              }`}>{e.status}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-ink/40">没有匹配的导出记录</p>}
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">导出设置</h2>
      <p className="mt-1 text-sm text-ink/60">配置默认导出格式、编码和分隔符。</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-primary/10 bg-surface/60 px-4 py-3">
          <span className="text-xs font-bold text-ink/50">默认格式</span>
          <p className="mt-1 text-sm font-bold text-primary">JSONL</p>
        </div>
        <div className="rounded-xl border border-primary/10 bg-surface/60 px-4 py-3">
          <span className="text-xs font-bold text-ink/50">编码</span>
          <p className="mt-1 text-sm font-bold text-primary">UTF-8</p>
        </div>
        <div className="rounded-xl border border-primary/10 bg-surface/60 px-4 py-3">
          <span className="text-xs font-bold text-ink/50">CSV 分隔符</span>
          <p className="mt-1 text-sm font-bold text-primary">逗号 (,)</p>
        </div>
        <div className="rounded-xl border border-primary/10 bg-surface/60 px-4 py-3">
          <span className="text-xs font-bold text-ink/50">空值处理</span>
          <p className="mt-1 text-sm font-bold text-primary">输出 null</p>
        </div>
      </div>
    </div>
  );
}
