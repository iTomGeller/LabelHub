/** 产品化中文标签：内部英文名仅作 tooltip / 次要信息 */

export const AGENT_ZH: Record<string, string> = {
  task_context_builder: "任务说明构建",
  dataset_sampler: "样例采样",
  schema_generator: "模板生成",
  rubric_generator: "规则生成",
  critic: "综合评估",
  task_package_writer: "发布打包",
};

export const NODE_ZH: Record<string, string> = {
  task_description: "任务说明",
  sample_data: "样例数据",
  annotation_template: "标注模板",
  quality_rules: "质检规则",
  comprehensive_assessment: "综合评估",
  publish_readiness: "发布准备",
};

export const TOOL_ZH: Record<string, string> = {
  dataset_profile_checker: "样例画像检查",
  schema_contract_checker: "模板契约检查",
  rubric_contract_checker: "规则契约检查",
  package_export_checker: "任务包导出检查",
  knowledge_base: "知识库检索",
  instruction_refine: "说明润色",
  "instruction-refine": "说明润色",
  "task-schema-builder": "模板构建",
};

export function agentLabel(id: string) {
  return AGENT_ZH[id] || id.replace(/_/g, " ");
}

export function nodeLabel(key: string) {
  return NODE_ZH[key] || key;
}

export function toolLabel(name: string) {
  return TOOL_ZH[name] || name.replace(/_/g, " ").replace(/-/g, " ");
}

export function statusLabelZh(status: string) {
  switch (status) {
    case "success": return "成功";
    case "warning": return "警告";
    case "hit": return "命中";
    case "empty": return "空召回";
    case "findings": return "有发现";
    case "available": return "可用";
    case "unavailable": return "不可用";
    case "failure":
    case "error": return "失败";
    default: return status === "?" ? "未知" : status;
  }
}

export const GRAFANA_AGENT_ZH = AGENT_ZH;
export const GRAFANA_NODE_ZH = NODE_ZH;

export const GRAFANA_AGENT_DASHBOARD_URL =
  "/grafana/d/labelhub-agent-rag-trace/labelhub-agent-diagnostic?orgId=1&from=now-6h&to=now&var-agent=$__all&var-node=$__all";
