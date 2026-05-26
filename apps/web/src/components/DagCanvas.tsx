"use client";

import { useEffect, useState, type ReactNode } from "react";
import { computeBusinessDagLayout } from "@/lib/dagLayout";

export interface DagNodeLayout {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
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
  children: ReactNode;
}

function portBottom(node: DagNodeLayout, nw: number, nh: number) {
  return { x: node.x + nw / 2, y: node.y + nh };
}

function portTop(node: DagNodeLayout, nw: number) {
  return { x: node.x + nw / 2, y: node.y };
}

/** 正交端口连线：从源底部到目标顶部，水平段走通道中线 */
function edgePath(from: DagNodeLayout, to: DagNodeLayout, nw: number, nh: number) {
  const a = portBottom(from, nw, nh);
  const b = portTop(to, nw);
  const channelY = a.y + Math.max(24, (b.y - a.y) * 0.45);

  if (Math.abs(a.x - b.x) < 4) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  return `M ${a.x} ${a.y} L ${a.x} ${channelY} L ${b.x} ${channelY} L ${b.x} ${b.y}`;
}

export function DagCanvas({
  width: propWidth,
  height: propHeight,
  nodes,
  edges,
  nodeWidth = 200,
  nodeHeight = 96,
  laneLabels,
  children,
}: Props) {
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const computed = computeBusinessDagLayout(nodeWidth, nodeHeight);
  const width = propWidth ?? computed.width;
  const height = propHeight ?? computed.height;

  return (
    <div className="relative mx-auto" style={{ width, height }}>
      {laneLabels?.map((lane) => (
        <div
          key={lane.label}
          className="absolute left-0 text-[10px] font-bold text-ink/30 pointer-events-none select-none"
          style={{ top: lane.y }}
        >
          {lane.label}
        </div>
      ))}
      <svg className="absolute inset-0 pointer-events-none z-0" width={width} height={height} aria-hidden>
        <defs>
          <marker id="dag-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="rgba(15, 76, 58, 0.5)" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const from = nodeMap[edge.from];
          const to = nodeMap[edge.to];
          if (!from || !to) return null;
          const nw = from.width ?? nodeWidth;
          const nh = from.height ?? nodeHeight;
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={edgePath(from, to, nw, nh)}
              fill="none"
              stroke="rgba(15, 76, 58, 0.45)"
              strokeWidth={2}
              strokeDasharray={edge.dashed ? "6 4" : undefined}
              markerEnd="url(#dag-arrow)"
            />
          );
        })}
      </svg>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** @deprecated use computeBusinessDagLayout from dagLayout.ts */
export const BUSINESS_DAG_LAYOUT: DagNodeLayout[] = computeBusinessDagLayout().layout;
export { BUSINESS_DAG_EDGES } from "@/lib/dagLayout";

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
