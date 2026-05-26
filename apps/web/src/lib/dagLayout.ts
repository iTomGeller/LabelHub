import type { DagEdge, DagNodeLayout } from "@/components/DagCanvas";

export const DEFAULT_NODE_W = 240;
export const DEFAULT_NODE_H = 118;
const H_GAP = 48;
const V_GAP = 72;
const PAD = 32;

/** 业务 DAG 拓扑：输入 → 三路并行 → 汇聚 → 终点 */
export const BUSINESS_DAG_EDGES: DagEdge[] = [
  { from: "task_description", to: "sample_data" },
  { from: "task_description", to: "annotation_template" },
  { from: "task_description", to: "quality_rules" },
  { from: "sample_data", to: "comprehensive_assessment" },
  { from: "annotation_template", to: "comprehensive_assessment" },
  { from: "quality_rules", to: "comprehensive_assessment" },
  { from: "comprehensive_assessment", to: "publish_readiness" },
];

const RANK_IDS: string[][] = [
  ["task_description"],
  ["sample_data", "annotation_template", "quality_rules"],
  ["comprehensive_assessment"],
  ["publish_readiness"],
];

export function computeBusinessDagLayout(
  nodeWidth = DEFAULT_NODE_W,
  nodeHeight = DEFAULT_NODE_H,
): { layout: DagNodeLayout[]; width: number; height: number } {
  const layout: DagNodeLayout[] = [];
  let maxRowWidth = 0;

  RANK_IDS.forEach((row, rank) => {
    const rowWidth = row.length * nodeWidth + (row.length - 1) * H_GAP;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
  });

  const canvasWidth = maxRowWidth + PAD * 2;

  RANK_IDS.forEach((row, rank) => {
    const rowWidth = row.length * nodeWidth + (row.length - 1) * H_GAP;
    const startX = PAD + (canvasWidth - PAD * 2 - rowWidth) / 2;
    const y = PAD + rank * (nodeHeight + V_GAP);
    row.forEach((id, i) => {
      layout.push({
        id,
        x: startX + i * (nodeWidth + H_GAP),
        y,
        width: nodeWidth,
        height: nodeHeight,
      });
    });
  });

  const height = PAD * 2 + RANK_IDS.length * nodeHeight + (RANK_IDS.length - 1) * V_GAP;
  return { layout, width: canvasWidth, height };
}

export const BUSINESS_DAG_LANE_LABELS = (() => {
  const nh = DEFAULT_NODE_H;
  const vg = V_GAP;
  const pad = PAD;
  return [
    { y: pad - 8, label: "输入" },
    { y: pad + nh + vg / 2 - 6, label: "并行检查" },
    { y: pad + 2 * (nh + vg) - vg / 2 - 6, label: "汇聚" },
    { y: pad + 3 * (nh + vg) - vg / 2 - 6, label: "终点" },
  ];
})();

/** 窄屏纵向 timeline 布局 */
export function computeVerticalDagLayout(
  nodeIds: string[],
  nodeWidth = DEFAULT_NODE_W,
  nodeHeight = DEFAULT_NODE_H,
): { layout: DagNodeLayout[]; width: number; height: number } {
  const layout = nodeIds.map((id, i) => ({
    id,
    x: PAD,
    y: PAD + i * (nodeHeight + 40),
    width: nodeWidth,
    height: nodeHeight,
  }));
  return {
    layout,
    width: nodeWidth + PAD * 2,
    height: PAD * 2 + nodeIds.length * nodeHeight + (nodeIds.length - 1) * 40,
  };
}
