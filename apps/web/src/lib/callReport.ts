import { toolLabel, statusLabelZh } from "./diagnosticLabels";

export interface CallRecord {
  id?: string;
  kind: "rag" | "skill" | "tool" | "sandbox" | "mcp";
  name: string;
  nameZh: string;
  status: string;
  statusZh: string;
  durationMs?: number;
  exitCode?: number;
  findings?: unknown[];
  conclusion?: string;
  whyCalled?: string;
  inputPreview?: Record<string, unknown>;
  outputPreview?: Record<string, unknown>;
  resultSummary?: string;
  degradeReason?: string;
  meta?: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function spanToCallRecord(span: Record<string, unknown>): CallRecord {
  const kind = String(span.kind || "tool") as CallRecord["kind"];
  const status = String(span.status || "success");
  const inputPreview = asRecord(span.inputPreview);
  const outputPreview = asRecord(span.outputPreview);
  const title = String(span.title || span.name || kind);
  const resultSummary = String(span.resultSummary || span.conclusion || "");
  const degradeReason = String(span.degradeReason || "");

  let name = title;
  if (kind === "rag") name = String(inputPreview?.query || "knowledge_base");
  if (kind === "skill") name = String(inputPreview?.skillName || title);
  if (kind === "tool" || kind === "sandbox") name = String(inputPreview?.checkTarget || title);
  if (kind === "mcp") name = String(inputPreview?.server || title);

  let statusZh = statusLabelZh(status);
  if (status === "hit") statusZh = "命中";
  if (status === "empty") statusZh = "空召回";
  if (status === "findings") statusZh = "有发现";
  if (status === "unavailable") statusZh = "不可用";

  return {
    id: String(span.id || ""),
    kind,
    name,
    nameZh: kind === "mcp" ? toolLabel(name) : toolLabel(name),
    status,
    statusZh,
    durationMs: Number(span.durationMs || 0),
    conclusion: resultSummary || degradeReason,
    whyCalled: String(span.whyCalled || ""),
    inputPreview,
    outputPreview,
    resultSummary,
    degradeReason,
    meta: span,
  };
}

export function countCalls(calls?: Record<string, unknown>) {
  if (!calls) return { rag: 0, skills: 0, tools: 0, sandbox: 0, mcp: 0, total: 0, spans: 0 };
  const spans = Array.isArray(calls.spans) ? calls.spans.length : 0;
  if (spans > 0) {
    const rows = (calls.spans as Record<string, unknown>[]).map(spanToCallRecord);
    return {
      rag: rows.filter((r) => r.kind === "rag").length,
      skills: rows.filter((r) => r.kind === "skill").length,
      tools: rows.filter((r) => r.kind === "tool").length,
      sandbox: rows.filter((r) => r.kind === "sandbox").length,
      mcp: rows.filter((r) => r.kind === "mcp").length,
      total: rows.length,
      spans,
    };
  }
  const tools = Array.isArray(calls.tools) ? calls.tools.length : 0;
  const sandbox = Array.isArray(calls.sandbox) ? calls.sandbox.length : 0;
  const mcp = Array.isArray(calls.mcp) ? calls.mcp.length : 0;
  const skills = calls.skills && typeof calls.skills === "object" && (calls.skills as Record<string, unknown>).used ? 1 : 0;
  const rag = calls.rag ? 1 : 0;
  return { rag, skills, tools, sandbox, mcp, total: rag + skills + tools + sandbox + mcp, spans: 0 };
}

export function flattenCalls(calls?: Record<string, unknown>): CallRecord[] {
  if (!calls) return [];

  const spans = calls.spans as Record<string, unknown>[] | undefined;
  if (spans && spans.length > 0) {
    return spans.map(spanToCallRecord);
  }

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
      whyCalled: "检索相关业务知识",
      inputPreview: {
        query: rag.query,
        auditNode: rag.auditNode,
        category: rag.category,
      },
      outputPreview: hit
        ? { hitCount: rag.hitCount, charCount: rag.charCount, topChunks: rag.retrievedChunks }
        : { emptyReason: rag.emptyReason },
      conclusion: hit ? `召回 ${String(rag.charCount || 0)} 字` : String(rag.emptyReason || "知识库未命中，使用静态规则兜底"),
      degradeReason: hit ? "" : String(rag.emptyReason || ""),
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
      whyCalled: "执行静态技能检查",
      outputPreview: { findings, findingCount: fc },
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
      inputPreview: asRecord(t.inputPreview),
      outputPreview: asRecord(t.outputPreview),
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
      inputPreview: asRecord(s.inputPreview),
      outputPreview: asRecord(s.outputPreview),
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
      whyCalled: "探测外部 MCP 服务可用性",
      inputPreview: asRecord(m.inputPreview) || { server: m.server, tool: m.tool },
      outputPreview: asRecord(m.outputPreview) || { status: m.status, error: m.error },
      degradeReason: String(m.error || ""),
      conclusion: st === "unavailable" ? String(m.error || "MCP 服务未配置或不可达") : "探测通过",
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
