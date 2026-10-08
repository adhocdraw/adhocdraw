// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import type { Node, Edge } from "@xyflow/react";
import { localApi } from "./localStore";

export interface DiagramSummary {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PageData {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface FlatDiagramData {
  nodes: Node[];
  edges: Edge[];
}

export interface CustomShape {
  id: string;
  name: string;
  url: string;
}

export interface PagedDiagramData {
  pages: PageData[];
  customShapes?: CustomShape[];
  // Canvas backdrop: dotted grid (default), plain, or plain with notebook
  // ruled lines (White Board).
  background?: "dots" | "plain" | "lines";
  // What the diagram was created as (New menu). Absent = a plain chart. White
  // Board and Notebook share their features for now; Notebook will grow its own.
  kind?: "whiteboard" | "notebook";
}

export type DiagramData = FlatDiagramData | PagedDiagramData;

export interface Diagram extends DiagramSummary {
  data: DiagramData;
}

export function isPagedData(data: DiagramData): data is PagedDiagramData {
  return Array.isArray((data as PagedDiagramData).pages);
}

// All diagrams, version history and images live in the visitor's own browser
// (IndexedDB) - there is no server. See localStore.ts.
export const api = localApi;

// Embedded (data:/blob:) and absolute URLs are used as they are.
export const absoluteUrl = (url: string) => url;

export interface DiagramVersionSummary {
  id: string;
  label: string;
  created_at: string;
}
