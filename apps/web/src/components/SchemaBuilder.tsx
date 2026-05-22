import { SUPPORTED_COMPONENT_TYPES, type SchemaComponent } from "@labelhub/contracts";

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

export function SchemaBuilder({ components }: { components: SchemaComponent[] }) {
  const selected = components[1] ?? components[0];
  const advancedRules = ["字段联动", "条件显示", "联动校验", "自定义校验", "分组容器", "多 Tab 布局"];

  return (
    <section className="rounded-3xl border border-primary/10 bg-white shadow-panel">
      <div className="flex items-center justify-between border-b border-primary/10 px-5 py-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary">SchemaBuilder</h2>
          <p className="text-sm text-ink/60">Designer 与 Renderer 解耦，产物为可版本化 JSON Schema。</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-xl border border-primary/20 px-4 py-2 text-sm font-bold text-primary">
            预览标注页
          </button>
          <button className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">保存草稿</button>
        </div>
      </div>

      <div className="grid grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="border-r border-primary/10 p-4">
          <h3 className="text-sm font-bold text-primary">ComponentLib</h3>
          <div className="mt-3 space-y-2">
            {SUPPORTED_COMPONENT_TYPES.map((type) => (
              <button
                key={type}
                className="w-full rounded-xl border border-primary/10 bg-surface px-3 py-2 text-left text-sm font-medium text-primary hover:border-accent"
              >
                {componentLabels[type]}
              </button>
            ))}
          </div>
        </aside>

        <div className="min-h-[420px] bg-surface/70 p-5">
          <div className="space-y-3">
            {components.map((component) => (
              <article key={component.id} className="rounded-2xl border border-primary/10 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                      {componentLabels[component.type]}
                    </p>
                    <h4 className="mt-1 text-lg font-bold text-primary">{component.label}</h4>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
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
          <h3 className="text-sm font-bold text-primary">PropertyPanel</h3>
          {selected ? (
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="font-semibold text-primary">label</span>
                <input className="mt-1 w-full rounded-xl border border-primary/20 px-3 py-2" value={selected.label} readOnly />
              </label>
              <label className="block">
                <span className="font-semibold text-primary">dataPath</span>
                <input
                  className="mt-1 w-full rounded-xl border border-primary/20 px-3 py-2 font-mono"
                  value={selected.dataPath}
                  readOnly
                />
              </label>
              <label className="block">
                <span className="font-semibold text-primary">required</span>
                <select className="mt-1 w-full rounded-xl border border-primary/20 px-3 py-2" value={`${selected.required}`} disabled>
                  <option>true</option>
                  <option>false</option>
                </select>
              </label>
              <div className="rounded-xl bg-surface p-3">
                <p className="font-semibold text-primary">validation</p>
                <pre className="mt-2 overflow-auto text-xs text-ink/70">
                  {JSON.stringify(selected.validation, null, 2)}
                </pre>
              </div>
              <div className="rounded-xl bg-surface p-3">
                <p className="font-semibold text-primary">进阶能力</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {advancedRules.map((rule) => (
                    <span key={rule} className="rounded-full bg-white px-2 py-1 text-xs font-bold text-primary">
                      {rule}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
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
