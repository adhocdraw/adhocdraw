// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useStore } from "@xyflow/react";

// True while at least one arrow starts or ends on this node. Borderless nodes (pencil
// strokes, text) use it to draw a thin frame, so an arrow visibly ends on something.
export function useConnected(id: string): boolean {
  return useStore((s) => s.edges.some((e) => e.source === id || e.target === id));
}
