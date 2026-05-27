"use client";

import { useEffect, useState, type ReactNode } from "react";
import { edgeChannel, LANE_GUTTER_W, rankForNode } from "@/lib/dagLayout";

export interface NodePorts {
  top: { side: "top" | "bottom" | "left" | "right"; offset: number };
  bottom: { side: "top" | "bottom" | "left" | "right"; offset: number };
  left: { side: "top" | "bottom" | "left" | "right"; offset: number };
  right: { side: "top" | "bottom" | "left" | "right"; offset: number };
  inputIndex: number;
  outputIndex: number;
  rank: number;
  channel: number;
}

export interface DagNodeLayout {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  ports?: NodePorts;
}

export interface DagEdge {
  from: string;
  to: string;
  dashed?: boolean;
}

interface Props {
  width?: number;
  height?: number;
  nodes: DagNodeLayout[];
  edges: DagEdge[];
  nodeWidth?: number;
  nodeHeight?: number;
  laneLabels?: { y: number; label: string }[];
  highlightNodeIds?: string[];
  markerPrefix?: string;
  laneGutter?: number;
  children: ReactNode;
}

function portPoint(node: DagNodeLayout, side: "top" | "bottom" | "left" | "right", nw: number, nh: number, channelOffset = 0) {
  const spread = Math.min(nw * 0.25, 36);
  const cx = node.x + nw / 2 + (channelOffset - 1) * spread;
  switch (side) {
    case "top": return { x: cx, y: node.y };
    case "bottom": return { x: cx, y: node.y + nh };
    case "left": return { x: node.x, y: node.y + nh / 2 };
    case "right": return { x: node.x + nw, y: node.y + nh / 2 };
  }
}

/** Rank-aware 正交路由：并行 rank 分配不同 channel，避免线条重叠 */
function edgePath(from: DagNodeLayout, to: DagNodeLayout, nw: number, nh: number, channel: number) {
  const fromRank = from.ports?.rank ?? rankForNode(from.id);
  const toRank = to.ports?.rank ?? rankForNode(to.id);
  const ch = channel >= 0 ? channel : edgeChannel(from.id, to.id, fromRank, toRank);

  let sourceSide: "top" | "bottom" | "left" | "right" = "bottom";
  let targetSide: "top" | "bottom" | "left" | "right" = "top";

  if (fromRank === toRank) {
    sourceSide = from.x < to.x ? "right" : "left";
    targetSide = from.x < to.x ? "left" : "right";
  } else if (fromRank > toRank) {
    sourceSide = "top";
    targetSide = "bottom";
  }

  const a = portPoint(from, sourceSide, nw, nh, ch + 1);
  const b = portPoint(to, targetSide, nw, nh, ch + 1);

  if (sourceSide === "bottom" && targetSide === "top") {
    const gap = b.y - a.y;
    const channelY = a.y + Math.max(28, gap * (0.35 + ch * 0.08));
    if (Math.abs(a.x - b.x) < 6) {
      return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    }
    return `M ${a.x} ${a.y} L ${a.x} ${channelY} L ${b.x} ${channelY} L ${b.x} ${b.y}`;
  }

  if ((sourceSide === "right" && targetSide === "left") || (sourceSide === "left" && targetSide === "right")) {
    const midX = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`;
  }

  const midY = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y}`;
}

export function DagCanvas({
  width: propWidth,
  height: propHeight,
  nodes,
  edges,
  nodeWidth = 200,
  nodeHeight = 96,
  laneLabels,
  highlightNodeIds,
  markerPrefix = "dag",
  laneGutter = LANE_GUTTER_W,
  children,
}: Props) {
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const highlight = new Set(highlightNodeIds ?? []);
  const markerId = `${markerPrefix}-arrow`;

  return (
    <div className="relative mx-auto" style={{ width: propWidth, height: propHeight }}>
      {laneLabels && laneGutter > 0 && (
        <div
          className="absolute top-0 bottom-0 border-r border-primary/5 bg-surface/20 pointer-events-none select-none"
          style={{ left: 0, width: laneGutter }}
        >
          {laneLabels.map((lane) => (
            <div
              key={lane.label}
              className="absolute left-0 right-0 flex items-center justify-center text-[10px] font-bold text-ink/35 px-1 text-center leading-tight"
              style={{ top: lane.y, height: nodeHeight }}
            >
              {lane.label}
            </div>
          ))}
        </div>
      )}
      <svg className="absolute inset-0 pointer-events-none z-0" width={propWidth} height={propHeight} aria-hidden>
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="rgba(15, 76, 58, 0.5)" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const from = nodeMap[edge.from];
          const to = nodeMap[edge.to];
          if (!from || !to) return null;
          const nw = from.width ?? nodeWidth;
          const nh = from.height ?? nodeHeight;
          const emphasized = highlight.size === 0 || (highlight.has(edge.from) && highlight.has(edge.to));
          const fromRank = from.ports?.rank ?? rankForNode(from.id);
          const toRank = to.ports?.rank ?? rankForNode(to.id);
          const channel = edgeChannel(from.id, to.id, fromRank, toRank);
          const isMainPath = fromRank === 0 && toRank === 3 || fromRank === 2 && toRank === 3;
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={edgePath(from, to, nw, nh, channel)}
              fill="none"
              stroke={emphasized ? "rgba(15, 76, 58, 0.55)" : "rgba(15, 76, 58, 0.12)"}
              strokeWidth={emphasized ? (isMainPath ? 2.75 : 2.25) : 1.25}
              strokeDasharray={edge.dashed ? "6 4" : undefined}
              markerEnd={`url(#${markerId})`}
            />
          );
        })}
      </svg>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function useNarrowScreen(breakpoint = 768) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return narrow;
}
