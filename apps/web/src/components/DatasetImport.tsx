"use client";

import type { DatasetImportPreview, DatasetSample } from "@labelhub/contracts";
import { SubTabs, SearchFilter } from "./SubTabs";
import { useState } from "react";

const sample: DatasetSample = {
  datasetId: "dataset_reviews_001",
  taskId: "task_text_cls_001",
  sampleSize: 3,
  fields: [
    { name: "comment", type: "string", nullRate: 0, example: "退款申请三天了还不到账，客服也没人回复。" },
    { name: "orderId", type: "string", nullRate: 0.12, example: "ORD-10001" },
    { name: "createdAt", type: "string", nullRate: 0, example: "2026-05-21T08:00:00Z" },
    { name: "channel", type: "string", nullRate: 0.05, example: "微信小程序" }
  ],
  examples: []
};

const importPreview: DatasetImportPreview = {
  datasetId: "dataset_reviews_001",
  taskId: "task_text_cls_001",
  acceptedFormats: ["json", "jsonl", "xlsx", "csv"],
  fields: sample.fields.map((field) => ({
    sourceField: field.name,
    inferredType: field.type,
    nullRate: field.nullRate,
    mappedPath: `$.raw.${field.name}`,
    example: field.example
  })),
  rejectedRows: [
    { rowNumber: 17, reason: "comment 字段为空，无法生成展示题面" },
    { rowNumber: 42, reason: "orderId 格式异常：含非法字符" },
    { rowNumber: 89, reason: "createdAt 解析失败：非标准 ISO 格式" }
  ],
  traceId: "trace_import_preview_task_text_cls_001"
};

const TABS = [
  { key: "upload", label: "数据上传" },
  { key: "mapping", label: "字段映射", count: importPreview.fields.length },
  { key: "errors", label: "错误日志", count: importPreview.rejectedRows.length }
];

export function DatasetImport() {
  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-primary/10 bg-white p-5 shadow-panel">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">数据工作区</p>
            <h1 className="mt-1 font-display text-3xl font-bold text-primary">数据导入与字段映射</h1>
            <p className="mt-1 text-sm text-ink/60">
              支持 {importPreview.acceptedFormats.join(" / ")}，预留图片压缩包和远程 URL。
            </p>
          </div>
          <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">开始导入</button>
        </div>
      </header>

      <SubTabs tabs={TABS} defaultTab="upload">
        {(tab) => {
          switch (tab) {
            case "upload":
              return <UploadTab />;
            case "mapping":
              return <MappingTab />;
            case "errors":
              return <ErrorsTab />;
            default:
              return null;
          }
        }}
      </SubTabs>
    </section>
  );
}

function UploadTab() {
  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">上传数据文件</h2>
      <p className="mt-1 text-sm text-ink/60">拖拽或点击选择文件开始导入，系统自动检测格式和编码。</p>

      <div className="mt-5 rounded-2xl border-2 border-dashed border-primary/20 bg-surface p-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
          <svg className="h-8 w-8 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="mt-4 text-lg font-bold text-primary">拖拽文件到这里</p>
        <p className="mt-2 text-sm text-ink/60">或点击下方按钮选择文件</p>
        <button className="mt-4 rounded-xl border border-primary/20 px-5 py-2.5 text-sm font-bold text-primary hover:border-accent">
          选择文件
        </button>
        <p className="mt-3 text-xs text-ink/40">支持 JSON / JSONL / Excel (.xlsx) / CSV，最大 50MB</p>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3">
        {importPreview.acceptedFormats.map((fmt) => (
          <div key={fmt} className="rounded-xl border border-primary/10 bg-surface/60 px-4 py-3 text-center">
            <p className="text-sm font-bold uppercase text-primary">.{fmt}</p>
            <p className="mt-1 text-xs text-ink/50">支持</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MappingTab() {
  const [search, setSearch] = useState("");
  const filtered = importPreview.fields.filter(
    (f) => !search || f.sourceField.toLowerCase().includes(search.toLowerCase()) || f.mappedPath.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primary">字段映射</h2>
          <p className="mt-1 text-sm text-ink/60">自动推断字段类型，并映射到标注数据路径。</p>
        </div>
        <div className="w-64">
          <SearchFilter placeholder="搜索字段名或路径..." value={search} onChange={setSearch} />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-primary/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary text-white">
            <tr>
              <th className="px-4 py-3 font-bold">源字段</th>
              <th className="px-4 py-3 font-bold">推断类型</th>
              <th className="px-4 py-3 font-bold">空值率</th>
              <th className="px-4 py-3 font-bold">映射目标</th>
              <th className="px-4 py-3 font-bold">示例</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((field) => (
              <tr key={field.sourceField} className="border-b border-primary/10 last:border-b-0">
                <td className="px-4 py-3 font-semibold text-primary">{field.sourceField}</td>
                <td className="px-4 py-3">
                  <span className="rounded-lg bg-accent/10 px-2 py-1 text-xs font-bold text-accent">{field.inferredType}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-bold ${field.nullRate > 0.1 ? "text-warning" : "text-success"}`}>
                    {Math.round(field.nullRate * 100)}%
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink/70">{field.mappedPath}</td>
                <td className="max-w-[240px] truncate px-4 py-3 text-ink/70">{String(field.example)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink/40">没有匹配的字段</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrorsTab() {
  const [search, setSearch] = useState("");
  const filtered = importPreview.rejectedRows.filter(
    (r) => !search || r.reason.includes(search) || String(r.rowNumber).includes(search)
  );

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primary">错误日志</h2>
          <p className="mt-1 text-sm text-ink/60">以下行因数据问题被拒绝，修正后可重新导入。</p>
        </div>
        <div className="w-64">
          <SearchFilter placeholder="搜索行号或错误原因..." value={search} onChange={setSearch} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((row) => (
          <div key={row.rowNumber} className="flex items-center gap-4 rounded-xl border border-danger/15 bg-danger/5 px-4 py-3">
            <span className="rounded-lg bg-danger/10 px-2 py-1 text-xs font-bold text-danger">第 {row.rowNumber} 行</span>
            <span className="text-sm text-primary">{row.reason}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">没有匹配的错误记录</p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-primary/10 bg-surface/60 px-4 py-3">
        <span className="text-xs font-bold text-ink/50">追踪号</span>
        <p className="mt-0.5 font-mono text-sm text-primary">{importPreview.traceId}</p>
      </div>
    </div>
  );
}
