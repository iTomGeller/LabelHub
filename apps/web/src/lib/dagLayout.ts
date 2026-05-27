import type { DagEdge, DagNodeLayout } from "@/components/DagCanvas";

export const DEFAULT_NODE_W = 240;
export const DEFAULT_NODE_H = 118;
export const LANE_GUTTER_W = 72;
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

function computePorts(id: string, rank: number, indexInRank: number, rowLength: number) {
  const inputIndex = rank;
  const outputIndex = indexInRank;
  return {
    top: { side: "top" as const, offset: 0.5 },
    bottom: { side: "bottom" as const, offset: 0.5 },
    left: { side: "left" as const, offset: 0.5 },
    right: { side: "right" as const, offset: 0.5 },
    inputIndex,
    outputIndex,
    rank,
    channel: rowLength > 1 ? indexInRank : 0,
  };
}

export function computeBusinessDagLayout(
  nodeWidth = DEFAULT_NODE_W,
  nodeHeight = DEFAULT_NODE_H,
): { layout: DagNodeLayout[]; width: number; height: number; laneGutter: number } {
  const layout: DagNodeLayout[] = [];
  let maxRowWidth = 0;

  RANK_IDS.forEach((row) => {
    const rowWidth = row.length * nodeWidth + (row.length - 1) * H_GAP;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
  });

  const canvasWidth = LANE_GUTTER_W + PAD * 2 + maxRowWidth;
  const nodeStartX = LANE_GUTTER_W + PAD;

  RANK_IDS.forEach((row, rank) => {
    const rowWidth = row.length * nodeWidth + (row.length - 1) * H_GAP;
    const startX = nodeStartX + (maxRowWidth - rowWidth) / 2;
    const y = PAD + rank * (nodeHeight + V_GAP);
    row.forEach((id, i) => {
      layout.push({
        id,
        x: startX + i * (nodeWidth + H_GAP),
        y,
        width: nodeWidth,
        height: nodeHeight,
        ports: computePorts(id, rank, i, row.length),
      });
    });
  });

  const height = PAD * 2 + RANK_IDS.length * nodeHeight + (RANK_IDS.length - 1) * V_GAP;
  return { layout, width: canvasWidth, height, laneGutter: LANE_GUTTER_W };
}

export const BUSINESS_DAG_LANE_LABELS = (() => {
  const nh = DEFAULT_NODE_H;
  const vg = V_GAP;
  const pad = PAD;
  return [
    { y: pad + nh / 2 - 8, label: "输入" },
    { y: pad + nh + vg / 2 + nh / 2 - 8, label: "并行检查" },
    { y: pad + 2 * (nh + vg) + nh / 2 - 8, label: "汇聚" },
    { y: pad + 3 * (nh + vg) + nh / 2 - 8, label: "终点" },
  ];
})();

/** 窄屏纵向 timeline 布局 */
export function computeVerticalDagLayout(
  nodeIds: string[],
  nodeWidth = DEFAULT_NODE_W,
  nodeHeight = DEFAULT_NODE_H,
): { layout: DagNodeLayout[]; width: number; height: number; laneGutter: number } {
  const layout = nodeIds.map((id, i) => ({
    id,
    x: PAD,
    y: PAD + i * (nodeHeight + 40),
    width: nodeWidth,
    height: nodeHeight,
    ports: computePorts(id, i, 0, 1),
  }));
  return {
    layout,
    width: nodeWidth + PAD * 2,
    height: PAD * 2 + nodeIds.length * nodeHeight + (nodeIds.length - 1) * 40,
    laneGutter: 0,
  };
}

export function rankForNode(nodeId: string): number {
  const idx = RANK_IDS.findIndex((row) => row.includes(nodeId));
  return idx >= 0 ? idx : 0;
}

export function edgeChannel(fromId: string, toId: string, fromRank: number, toRank: number): number {
  if (fromRank === 0 && toRank === 1) {
    const targets = RANK_IDS[1];
    return targets.indexOf(toId);
  }
  if (fromRank === 1 && toRank === 2) {
    const sources = RANK_IDS[1];
    return sources.indexOf(fromId);
  }
  return 0;
}
