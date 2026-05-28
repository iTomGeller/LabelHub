import type { BusinessNode } from "@/components/AuditBusinessDag";

export type BusinessVerdict = "可发布" | "低置信" | "需修复" | "外部依赖不可用";

export function businessVerdict(node: BusinessNode): BusinessVerdict {
  const ragEmpty = node.details?.ragStatus === "empty";
  const mcpUnavailable = hasMcpUnavailable(node.details?.calls as Record<string, unknown> | undefined);
  if (mcpUnavailable) return "外部依赖不可用";
  if (node.status !== "success") return "需修复";
  if (ragEmpty) return "低置信";
  return "可发布";
}

function hasMcpUnavailable(calls?: Record<string, unknown>) {
  const mcp = calls?.mcp;
  if (!Array.isArray(mcp)) return false;
  return mcp.some((m) => m && typeof m === "object" && (m as Record<string, unknown>).status === "unavailable");
}

export function verdictTone(v: BusinessVerdict) {
  switch (v) {
    case "可发布": return { bg: "bg-success/10", text: "text-success", border: "border-success/20" };
    case "低置信": return { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" };
    case "需修复": return { bg: "bg-danger/10", text: "text-danger", border: "border-danger/20" };
    case "外部依赖不可用": return { bg: "bg-ink/5", text: "text-ink/70", border: "border-ink/20" };
  }
}

export function upstreamDownstream(nodeKey: string): { upstream: string[]; downstream: string[] } {
  const edges: Record<string, { up: string[]; down: string[] }> = {
    task_description: { up: [], down: ["sample_data", "annotation_template", "quality_rules"] },
    sample_data: { up: ["task_description"], down: ["comprehensive_assessment"] },
    annotation_template: { up: ["task_description"], down: ["comprehensive_assessment"] },
    quality_rules: { up: ["task_description"], down: ["comprehensive_assessment"] },
    comprehensive_assessment: { up: ["sample_data", "annotation_template", "quality_rules"], down: ["publish_readiness"] },
    publish_readiness: { up: ["comprehensive_assessment"], down: [] },
  };
  return { upstream: edges[nodeKey]?.up ?? [], downstream: edges[nodeKey]?.down ?? [] };
}
