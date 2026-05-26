"use client";

import type { ReactNode } from "react";

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
}

interface Props {
  width: number;
  height: number;
  nodes: DagNodeLayout[];
  edges: DagEdge[];
  nodeWidth?: number;
  nodeHeight?: number;
  children: ReactNode;
}

function centerOf(node: DagNodeLayout, nodeWidth: number, nodeHeight: number) {
  return {
    x: node.x + nodeWidth / 2,
    y: node.y + nodeHeight / 2,
  };
}

function edgePath(from: DagNodeLayout, to: DagNodeLayout, nodeWidth: number, nodeHeight: number) {
  const a = centerOf(from, nodeWidth, nodeHeight);
  const b = centerOf(to, nodeWidth, nodeHeight);
  const midY = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y + nodeHeight / 2} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y - nodeHeight / 2}`;
}

export function DagCanvas({ width, height, nodes, edges, nodeWidth = 180, nodeHeight = 120, children }: Props) {
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div className="relative mx-auto" style={{ width, height }}>
      <svg className="absolute inset-0 pointer-events-none" width={width} height={height} aria-hidden>
        <defs>
          <marker id="dag-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="rgba(15, 76, 58, 0.35)" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const from = nodeMap[edge.from];
          const to = nodeMap[edge.to];
          if (!from || !to) return null;
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={edgePath(from, to, nodeWidth, nodeHeight)}
              fill="none"
              stroke="rgba(15, 76, 58, 0.35)"
              strokeWidth={2}
              markerEnd="url(#dag-arrow)"
            />
          );
        })}
      </svg>
      {children}
    </div>
  );
}

export const BUSINESS_DAG_LAYOUT: DagNodeLayout[] = [
  { id: "task_description", x: 310, y: 0 },
  { id: "sample_data", x: 40, y: 150 },
  { id: "annotation_template", x: 310, y: 150 },
  { id: "quality_rules", x: 580, y: 150 },
  { id: "comprehensive_assessment", x: 220, y: 300 },
  { id: "publish_readiness", x: 420, y: 300 },
];

export const BUSINESS_DAG_EDGES: DagEdge[] = [
  { from: "task_description", to: "sample_data" },
  { from: "task_description", to: "annotation_template" },
  { from: "task_description", to: "quality_rules" },
  { from: "sample_data", to: "comprehensive_assessment" },
  { from: "annotation_template", to: "comprehensive_assessment" },
  { from: "quality_rules", to: "comprehensive_assessment" },
  { from: "comprehensive_assessment", to: "publish_readiness" },
];
