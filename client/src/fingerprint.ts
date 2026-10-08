// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import type { DiagramData } from "./api";

// A stable summary of a diagram's real content, used to tell whether it has
// changed since it was last saved to / opened from a file. It leaves out
// things that change without the user editing anything: selection, measured
// sizes, drag state, the viewport (pan/zoom) and page ids.
type Loose = Record<string, unknown>;

const round = (n: unknown) => (typeof n === "number" ? Math.round(n * 10) / 10 : n);

const node = (n: Loose) => ({
  id: n.id,
  type: n.type,
  parentId: n.parentId,
  zIndex: n.zIndex,
  position: n.position && { x: round((n.position as Loose).x), y: round((n.position as Loose).y) },
  data: n.data,
  style: n.style,
});

const edge = (e: Loose) => ({
  id: e.id,
  source: e.source,
  target: e.target,
  sourceHandle: e.sourceHandle,
  targetHandle: e.targetHandle,
  type: e.type,
  label: e.label,
  data: e.data,
  style: e.style,
  markerStart: e.markerStart,
  markerEnd: e.markerEnd,
});

export function isEmptyDiagram(data: DiagramData): boolean {
  const pages = "pages" in data ? data.pages : [{ nodes: data.nodes, edges: data.edges }];
  return pages.every((p) => p.nodes.length === 0 && p.edges.length === 0);
}

export function fingerprint(data: DiagramData): string {
  const pages = "pages" in data ? data.pages : [{ id: "p1", name: "Page 1", nodes: data.nodes, edges: data.edges }];
  const text = JSON.stringify({
    pages: pages.map((p) => ({
      name: (p as unknown as Loose).name,
      nodes: (p.nodes as unknown as Loose[]).map(node),
      edges: (p.edges as unknown as Loose[]).map(edge),
    })),
    customShapes: ("customShapes" in data ? data.customShapes : undefined) ?? [],
    background: ("background" in data ? data.background : undefined) ?? "dots",
    kind: ("kind" in data ? data.kind : undefined) ?? null,
  });
  // djb2 - only needs to notice changes, not resist tampering.
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${text.length}:${h}`;
}
