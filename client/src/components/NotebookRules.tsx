// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useViewport } from "@xyflow/react";

// Notebook ruled lines for the White Board: horizontal rules every 32 canvas
// units (twice the snap grid, so shapes snap onto them), drawn behind the
// nodes and moving/zooming with the canvas. Colours are in App.css
// (.notebook-rules); the pointer passes straight through.
const RULE_GAP = 32;

export default function NotebookRules() {
  const { y, zoom } = useViewport();
  const gap = RULE_GAP * zoom;
  // Too dense to be useful (and moire-prone) when zoomed far out.
  if (gap < 7) return null;
  return (
    <div
      className="notebook-rules"
      aria-hidden="true"
      style={{ backgroundSize: `100% ${gap}px`, backgroundPosition: `0 ${y % gap}px` }}
    />
  );
}
