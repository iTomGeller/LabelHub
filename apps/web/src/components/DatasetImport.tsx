import type { DatasetImportPreview, DatasetSample } from "@labelhub/contracts";

const sample: DatasetSample = {
  datasetId: "dataset_reviews_001",
  taskId: "task_text_cls_001",
  sampleSize: 3,
  fields: [
    { name: "comment", type: "string", nullRate: 0, example: "退款申请三天了还不到账，客服也没人回复。" },
    { name: "orderId", type: "string", nullRate: 0.12, example: "ORD-10001" },
    { name: "createdAt", type: "string", nullRate: 0, example: "2026-05-21T08:00:00Z" }
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
  rejectedRows: [{ rowNumber: 17, reason: "comment 字段为空，无法生成展示题面" }],
  traceId: "trace_import_preview_task_text_cls_001"
};

export function DatasetImport() {
  return (
    <section className="rounded-3xl border border-primary/10 bg-white p-5 shadow-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary">数据导入与字段映射</h2>
          <p className="mt-1 text-sm text-ink/60">
            支持 {importPreview.acceptedFormats.join(" / ")}，预留图片压缩包和远程 URL。
          </p>
        </div>
        <button className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">导入预览</button>
      </div>

      <div className="mt-5 grid grid-cols-[260px_minmax(0,1fr)] gap-5">
        <div className="rounded-2xl border border-dashed border-primary/25 bg-surface p-5 text-center">
          <p className="font-bold text-primary">拖拽上传数据文件</p>
          <p className="mt-2 text-sm leading-6 text-ink/60">JSON / JSONL / Excel / CSV</p>
          <button className="mt-4 rounded-xl border border-primary/20 px-4 py-2 text-sm font-bold text-primary">
            选择文件
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-primary/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-4 py-3">源字段</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3">空值率</th>
                <th className="px-4 py-3">映射目标</th>
                <th className="px-4 py-3">示例</th>
              </tr>
            </thead>
            <tbody>
              {importPreview.fields.map((field) => (
                <tr key={field.sourceField} className="border-b border-primary/10 last:border-b-0">
                  <td className="px-4 py-3 font-semibold text-primary">{field.sourceField}</td>
                  <td className="px-4 py-3">{field.inferredType}</td>
                  <td className="px-4 py-3">{Math.round(field.nullRate * 100)}%</td>
                  <td className="px-4 py-3 font-mono text-xs">{field.mappedPath}</td>
                  <td className="max-w-[280px] truncate px-4 py-3 text-ink/70">{String(field.example)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
        错误行提示：第 {importPreview.rejectedRows[0]?.rowNumber} 行，{importPreview.rejectedRows[0]?.reason}。
        traceId: <span className="font-mono">{importPreview.traceId}</span>
      </div>
    </section>
  );
}
