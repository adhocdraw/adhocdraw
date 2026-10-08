// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import type { Node, Edge } from "@xyflow/react";
import { v4 as uuid } from "uuid";
import type { PagedDiagramData } from "./api";
import type { IconName } from "./components/Icon";

export interface DiagramTemplate {
  key: string;
  label: string;
  // New diagrams are named after the option used: "<defaultName> 1", "<defaultName> 2"...
  defaultName: string;
  // Icon shown beside the option in the New menu.
  icon: IconName;
  build: () => PagedDiagramData;
  // Open the diagram with the Pencil tool already switched on.
  startsWithPencil?: boolean;
}

// Templates are full multi-page diagrams, like anything saved from the editor.
function singlePage(
  nodes: Node[],
  edges: Edge[],
  background?: "dots" | "plain" | "lines",
  kind?: "whiteboard" | "notebook"
): PagedDiagramData {
  return {
    pages: [{ id: uuid(), name: "Page 1", nodes, edges }],
    customShapes: [],
    ...(background && { background }),
    ...(kind && { kind }),
  };
}

export const TEMPLATES: DiagramTemplate[] = [
  { key: "blank", label: "Blank Chart", defaultName: "Chart", icon: "blankChart", build: () => singlePage([], []) },
  // Same empty canvas, but ready to draw: the Pencil is on from the start.
  { key: "whiteboard", label: "White Board", defaultName: "White Board", icon: "whiteboard", build: () => singlePage([], [], "plain", "whiteboard"), startsWithPencil: true },
  // Starts as a copy of the White Board (ruled lines, Pencil on); notebook-only features come later.
  { key: "notebook", label: "Notebook", defaultName: "Notebook", icon: "notebook", build: () => singlePage([], [], "lines", "notebook"), startsWithPencil: true },
];
