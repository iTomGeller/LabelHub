"use client";

import { SUPPORTED_COMPONENT_TYPES, type SchemaComponent, type SchemaComponentType } from "@labelhub/contracts";
import { SubTabs, SearchFilter } from "./SubTabs";
import { useState } from "react";

const componentLabels: Record<string, string> = {
  shortText: "单行输入",
  longText: "多行文本",
  singleChoice: "单选",
  multiChoice: "多选",
  tagSelect: "标签选择",
  richText: "富文本",
  fileUpload: "文件/图片上传",
  jsonEditor: "JSON 编辑器",
  llmInteraction: "LLM 交互",
  showItem: "展示项"
};

const TABS = [
  { key: "canvas", label: "画布视图" },
  { key: "list", label: "组件列表" },
  { key: "rules", label: "校验规则" },
  { key: "preview", label: "JSON 预览" }
];

export function SchemaBuilder({ components }: { components: SchemaComponent[] }) {
  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between rounded-2xl border border-primary/10 bg-white p-5 shadow-panel">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">模板工作区</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-primary">标注模板搭建器</h1>
          <p className="mt-1 text-sm text-ink/60">搭建器与渲染器解耦，产物为可版本化的标注模板 JSON。</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-xl border border-primary/20 px-4 py-2.5 text-sm font-bold text-primary hover:border-accent">预览标注页</button>
          <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">保存草稿</button>
        </div>
      </header>

      <SubTabs tabs={TABS.map((t) => ({ ...t, count: t.key === "list" ? components.length : undefined }))} defaultTab="canvas">
        {(tab) => {
          switch (tab) {
            case "canvas":
              return <CanvasTab components={components} />;
            case "list":
              return <ListTab components={components} />;
            case "rules":
              return <RulesTab components={components} />;
            case "preview":
              return <PreviewTab components={components} />;
            default:
              return null;
          }
        }}
      </SubTabs>
    </section>
  );
}

function CanvasTab({ components }: { components: SchemaComponent[] }) {
  const [selected, setSelected] = useState<SchemaComponent | null>(components[0] ?? null);

  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)_280px] overflow-hidden rounded-2xl border border-primary/10 bg-white">
      <aside className="border-r border-primary/10 bg-surface/50 p-4">
        <h3 className="text-sm font-bold text-primary">组件库</h3>
        <div className="mt-3 space-y-1.5">
          {SUPPORTED_COMPONENT_TYPES.map((type) => (
            <button
              key={type}
              className="w-full rounded-xl border border-primary/10 bg-white px-3 py-2 text-left text-sm font-medium text-primary hover:border-accent"
            >
              {componentLabels[type]}
            </button>
          ))}
        </div>
      </aside>

      <div className="min-h-[460px] bg-surface/30 p-5">
        <div className="space-y-3">
          {components.map((component) => (
            <article
              key={component.id}
              onClick={() => setSelected(component)}
              className={`cursor-pointer rounded-2xl border bg-white p-4 transition-colors ${
                selected?.id === component.id ? "border-accent shadow-sm" : "border-primary/10 hover:border-accent/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                    {componentLabels[component.type]}
                  </p>
                  <h4 className="mt-1 text-base font-bold text-primary">{component.label}</h4>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                  {component.dataPath}
                </span>
              </div>
              <div className="mt-3 rounded-xl border border-dashed border-primary/20 bg-surface p-3 text-sm text-ink/70">
                {renderPreview(component)}
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="border-l border-primary/10 p-4">
        <h3 className="text-sm font-bold text-primary">属性配置</h3>
        {selected ? (
          <div className="mt-4 space-y-3 text-sm">
            <PropField label="字段名称" value={selected.label} />
            <PropField label="数据路径" value={selected.dataPath} mono />
            <PropField label="是否必填" value={selected.required ? "是" : "否"} />
            <PropField label="组件类型" value={componentLabels[selected.type]} />
            <div className="rounded-xl bg-surface p-3">
              <p className="font-semibold text-primary">校验规则</p>
              <pre className="mt-2 overflow-auto text-xs text-ink/70">
                {JSON.stringify(selected.validation, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink/40">选择一个组件查看属性</p>
        )}
      </aside>
    </div>
  );
}

function ListTab({ components }: { components: SchemaComponent[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<SchemaComponentType | "all">("all");

  const filtered = components.filter((c) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (search && !c.label.toLowerCase().includes(search.toLowerCase()) && !c.dataPath.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <SearchFilter placeholder="搜索组件名称或路径..." value={search} onChange={setSearch} />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as SchemaComponentType | "all")}
          className="rounded-xl border border-primary/15 bg-white px-3 py-2.5 text-sm font-bold text-primary"
        >
          <option value="all">全部类型</option>
          {SUPPORTED_COMPONENT_TYPES.map((t) => (
            <option key={t} value={t}>{componentLabels[t]}</option>
          ))}
        </select>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-primary/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary text-white">
            <tr>
              <th className="px-4 py-3 font-bold">组件名称</th>
              <th className="px-4 py-3 font-bold">类型</th>
              <th className="px-4 py-3 font-bold">路径</th>
              <th className="px-4 py-3 font-bold">必填</th>
              <th className="px-4 py-3 font-bold">校验数</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-primary/10 last:border-b-0">
                <td className="px-4 py-3 font-semibold text-primary">{c.label}</td>
                <td className="px-4 py-3">
                  <span className="rounded-lg bg-accent/10 px-2 py-1 text-xs font-bold text-accent">{componentLabels[c.type]}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink/70">{c.dataPath}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold ${c.required ? "text-success" : "text-ink/40"}`}>
                    {c.required ? "是" : "否"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-bold text-primary">{c.validation.length}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink/40">没有匹配的组件</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink/40">共 {components.length} 个组件，当前显示 {filtered.length} 个</p>
    </div>
  );
}

function RulesTab({ components }: { components: SchemaComponent[] }) {
  const [search, setSearch] = useState("");
  const allRules = components.flatMap((c) =>
    c.validation.map((v) => ({ componentLabel: c.label, componentType: c.type, ...v }))
  );
  const filtered = allRules.filter(
    (r) => !search || r.componentLabel.includes(search) || r.type.includes(search) || r.message.includes(search)
  );

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primary">全局校验规则</h2>
          <p className="mt-1 text-sm text-ink/60">汇总所有组件的校验配置，便于全局审查。</p>
        </div>
        <div className="w-64">
          <SearchFilter placeholder="搜索组件或规则..." value={search} onChange={setSearch} />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {filtered.map((rule, idx) => (
          <div key={idx} className="flex items-center gap-4 rounded-xl border border-primary/10 bg-surface/60 px-4 py-3">
            <span className="rounded-lg bg-accent/10 px-2 py-1 text-xs font-bold text-accent">{rule.type}</span>
            <span className="text-sm font-semibold text-primary">{rule.componentLabel}</span>
            <span className="flex-1 text-sm text-ink/60">{rule.message}</span>
            {rule.value !== undefined && (
              <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-mono text-primary">{String(rule.value)}</span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">没有匹配的校验规则</p>
        )}
      </div>
      <p className="mt-3 text-xs text-ink/40">共 {allRules.length} 条规则</p>
    </div>
  );
}

function PreviewTab({ components }: { components: SchemaComponent[] }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6">
      <h2 className="text-lg font-bold text-primary">JSON 预览</h2>
      <p className="mt-1 text-sm text-ink/60">这是最终冻结进任务包的标注模板 JSON 片段。</p>
      <pre className="mt-4 max-h-[600px] overflow-auto rounded-xl bg-primary p-5 text-xs leading-5 text-white/90">
        {JSON.stringify(components, null, 2)}
      </pre>
    </div>
  );
}

function PropField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <label className="block">
      <span className="font-semibold text-primary">{label}</span>
      <input
        className={`mt-1 w-full rounded-xl border border-primary/20 px-3 py-2 text-sm ${mono ? "font-mono" : ""}`}
        value={value}
        readOnly
      />
    </label>
  );
}

function renderPreview(component: SchemaComponent) {
  switch (component.type) {
    case "showItem":
      return "渲染原始数据展示块：{{raw.comment}}";
    case "shortText":
      return "渲染单行输入，适合订单号、实体短文本和字段修正";
    case "longText":
      return "渲染多行文本输入，提交前执行必填与最小长度校验";
    case "singleChoice":
      return "渲染单选项：咨询 / 投诉 / 夸赞 / 售后 / 无关";
    case "multiChoice":
      return "渲染多选项，并限制最少 1 项、最多 3 项";
    case "tagSelect":
      return "渲染标签选择，上限 3 个标签";
    case "richText":
      return "渲染富文本说明摘录，支持加粗、引用和说明片段";
    case "fileUpload":
      return "渲染文件/图片上传，占位 OSS/MinIO mediaRefs";
    case "jsonEditor":
      return "渲染 JSON 编辑器，用于结构化补充字段";
    case "llmInteraction":
      return "渲染 LLM 辅助按钮，记录输入、输出和采纳状态";
  }
}
