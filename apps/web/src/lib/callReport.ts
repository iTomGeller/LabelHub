export interface CallRecord {
  kind: "rag" | "skill" | "tool" | "sandbox" | "mcp";
  name: string;
  status: string;
  durationMs?: number;
  exitCode?: number;
  findings?: unknown[];
  detail?: string;
  meta?: Record<string, unknown>;
}

export function countCalls(calls?: Record<string, unknown>) {
  if (!calls) return { rag: 0, skills: 0, tools: 0, sandbox: 0, mcp: 0, total: 0 };
  const tools = Array.isArray(calls.tools) ? calls.tools.length : 0;
  const sandbox = Array.isArray(calls.sandbox) ? calls.sandbox.length : 0;
  const mcp = Array.isArray(calls.mcp) ? calls.mcp.length : 0;
  const skills = calls.skills && typeof calls.skills === "object" && (calls.skills as Record<string, unknown>).used ? 1 : 0;
  const rag = calls.rag ? 1 : 0;
  return { rag, skills, tools, sandbox, mcp, total: rag + skills + tools + sandbox + mcp };
}

export function flattenCalls(calls?: Record<string, unknown>): CallRecord[] {
  if (!calls) return [];
  const rows: CallRecord[] = [];

  const rag = calls.rag as Record<string, unknown> | undefined;
  if (rag) {
    rows.push({
      kind: "rag",
      name: String(rag.source || "knowledge_base"),
      status: rag.hasContent ? "hit" : "empty",
      durationMs: Number(rag.durationMs || 0),
      detail: rag.hasContent ? `${String(rag.charCount || 0)} 字召回` : "知识库未命中",
      meta: rag,
    });
  }

  const skills = calls.skills as Record<string, unknown> | undefined;
  if (skills?.used) {
    const skillNames = (skills.skills as string[]) || [];
    const findings = (skills.findings as string[]) || [];
    rows.push({
      kind: "skill",
      name: skillNames.join(", ") || "skills",
      status: Number(skills.findingCount || 0) > 0 ? "findings" : "success",
      detail: `${skillNames.length} skills · ${Number(skills.findingCount || 0)} findings`,
      findings,
      meta: skills,
    });
  }

  for (const t of (calls.tools as Record<string, unknown>[] | undefined) || []) {
    rows.push({
      kind: "tool",
      name: String(t.tool || "tool"),
      status: String(t.status || "?"),
      durationMs: Number(t.durationMs || 0),
      exitCode: Number(t.exitCode ?? 0),
      findings: Array.isArray(t.findings) ? t.findings : [],
      detail: `exit ${String(t.exitCode ?? "?")}`,
      meta: t,
    });
  }

  for (const s of (calls.sandbox as Record<string, unknown>[] | undefined) || []) {
    rows.push({
      kind: "sandbox",
      name: String(s.tool || "sandbox"),
      status: String(s.status || "?"),
      durationMs: Number(s.durationMs || 0),
      exitCode: Number(s.exitCode ?? 0),
      findings: Array.isArray(s.findings) ? s.findings : [],
      detail: `exit ${String(s.exitCode ?? "?")}`,
      meta: s,
    });
  }

  for (const m of (calls.mcp as Record<string, unknown>[] | undefined) || []) {
    rows.push({
      kind: "mcp",
      name: String(m.server || m.tool || "mcp"),
      status: String(m.status || "?"),
      detail: String(m.tool || "probe"),
      meta: m,
    });
  }

  return rows;
}

export function callKindLabel(kind: CallRecord["kind"]) {
  switch (kind) {
    case "rag": return "RAG";
    case "skill": return "Skill";
    case "tool": return "Tool";
    case "sandbox": return "Sandbox";
    case "mcp": return "MCP";
  }
}

export function callStatusTone(status: string) {
  if (["success", "hit", "available"].includes(status)) return "text-success bg-success/10 border-success/20";
  if (["empty", "findings", "warning"].includes(status)) return "text-warning bg-warning/10 border-warning/20";
  return "text-danger bg-danger/10 border-danger/20";
}
