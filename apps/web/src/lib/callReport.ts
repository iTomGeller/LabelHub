import { toolLabel, statusLabelZh } from "./diagnosticLabels";

export interface CallRecord {
  kind: "rag" | "skill" | "tool" | "sandbox" | "mcp";
  name: string;
  nameZh: string;
  status: string;
  statusZh: string;
  durationMs?: number;
  exitCode?: number;
  findings?: unknown[];
  conclusion?: string;
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
    const hit = Boolean(rag.hasContent);
    rows.push({
      kind: "rag",
      name: String(rag.source || "knowledge_base"),
      nameZh: "知识库检索",
      status: hit ? "hit" : "empty",
      statusZh: hit ? "命中" : "空召回",
      durationMs: Number(rag.durationMs || 0),
      conclusion: hit ? `召回 ${String(rag.charCount || 0)} 字` : String(rag.emptyReason || "知识库未命中，使用静态规则兜底"),
      meta: rag,
    });
  }

  const skills = calls.skills as Record<string, unknown> | undefined;
  if (skills?.used) {
    const skillNames = (skills.skills as string[]) || [];
    const findings = (skills.findings as string[]) || [];
    const fc = Number(skills.findingCount || findings.length || 0);
    rows.push({
      kind: "skill",
      name: skillNames.join(", ") || "skills",
      nameZh: skillNames.map(toolLabel).join("、") || "技能调用",
      status: fc > 0 ? "findings" : "success",
      statusZh: fc > 0 ? `${fc} 条发现` : "成功",
      conclusion: findings.length > 0 ? findings.slice(0, 2).map(String).join("；") : "检查完成，未发现额外问题",
      findings,
      meta: skills,
    });
  }

  for (const t of (calls.tools as Record<string, unknown>[] | undefined) || []) {
    const name = String(t.tool || "tool");
    const st = String(t.status || "success");
    const findings = Array.isArray(t.findings) ? t.findings : [];
    rows.push({
      kind: "tool",
      name,
      nameZh: toolLabel(name),
      status: st,
      statusZh: statusLabelZh(st),
      durationMs: Number(t.durationMs || 0),
      exitCode: Number(t.exitCode ?? 0),
      findings,
      conclusion: findings.length > 0 ? findings.slice(0, 2).map(String).join("；") : "自动检查通过",
      meta: t,
    });
  }

  for (const s of (calls.sandbox as Record<string, unknown>[] | undefined) || []) {
    const name = String(s.tool || "sandbox");
    const st = String(s.status || "success");
    const findings = Array.isArray(s.findings) ? s.findings : [];
    rows.push({
      kind: "sandbox",
      name,
      nameZh: toolLabel(name),
      status: st,
      statusZh: statusLabelZh(st),
      durationMs: Number(s.durationMs || 0),
      exitCode: Number(s.exitCode ?? 0),
      findings,
      conclusion: findings.length > 0 ? findings.slice(0, 2).map(String).join("；") : "数据集校验通过",
      meta: s,
    });
  }

  for (const m of (calls.mcp as Record<string, unknown>[] | undefined) || []) {
    const name = String(m.server || m.tool || "mcp");
    const st = String(m.status || "?");
    rows.push({
      kind: "mcp",
      name,
      nameZh: toolLabel(name),
      status: st,
      statusZh: statusLabelZh(st),
      conclusion: st === "unavailable" ? "MCP 服务未配置或不可达" : "探测通过",
      meta: m,
    });
  }

  return rows;
}

export function callKindLabel(kind: CallRecord["kind"]) {
  switch (kind) {
    case "rag": return "知识库";
    case "skill": return "技能";
    case "tool": return "工具";
    case "sandbox": return "沙箱";
    case "mcp": return "MCP";
  }
}

export function callStatusTone(status: string) {
  if (["success", "hit", "available"].includes(status)) return "text-success bg-success/10 border-success/20";
  if (["empty", "findings", "warning"].includes(status)) return "text-warning bg-warning/10 border-warning/20";
  return "text-danger bg-danger/10 border-danger/20";
}

export function nodeConclusion(status: string, summary: string, ragEmpty?: boolean) {
  if (status !== "success") return `需关注：${summary}`;
  if (ragEmpty) return `已通过，但知识库空召回，置信度偏低`;
  return `通过：${summary}`;
}
