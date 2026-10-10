// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useViewport } from "@xyflow/react";

// A Notebook is a page: a sheet of paper of fixed width on a grey desk, scrolled
// down (never sideways). This draws the sheet - and, when "Notebook lines" is on,
// its ruled lines and red margin line - behind the shapes, moving and zooming
// with the canvas. Colours are in App.css (.notebook-page). Pointers pass through.
export const PAGE_WIDTH = 800;
export const PAGE_MARGIN = 24;
// Notebook ruled lines are this far apart (canvas units); the margin line sits
// this far in from the page's left edge.
const RULE_GAP = 32;
const MARGIN_LINE_X = 72;

export interface PageBounds {
  x0: number;
  x1: number;
  y0: number;
}

export const DEFAULT_PAGE_BOUNDS: PageBounds = { x0: 0, x1: PAGE_WIDTH, y0: 0 };

// The page is PAGE_WIDTH wide; content that is already outside it (an older
// notebook, or a pasted shape) widens the page just enough to stay reachable.
export function pageBoundsFor(nodes: { position: { x: number; y: number }; width?: number; measured?: { width?: number }; style?: { width?: unknown }; parentId?: string }[]): PageBounds {
  let { x0, x1, y0 } = DEFAULT_PAGE_BOUNDS;
  for (const n of nodes) {
    if (n.parentId) continue;
    const w = n.measured?.width ?? (typeof n.style?.width === "number" ? n.style.width : n.width ?? 150);
    x0 = Math.min(x0, n.position.x - PAGE_MARGIN);
    x1 = Math.max(x1, n.position.x + w + PAGE_MARGIN);
    y0 = Math.min(y0, n.position.y - PAGE_MARGIN);
  }
  return { x0, x1, y0 };
}

// Zoom and offset that show the whole page width (never zoomed in past 100%),
// centred, starting at the top.
export function notebookFitViewport(canvasWidth: number, b: PageBounds) {
  const pageW = b.x1 - b.x0;
  const zoom = Math.max(0.1, Math.min(1, canvasWidth / pageW));
  return { x: (canvasWidth - pageW * zoom) / 2 - b.x0 * zoom, y: -b.y0 * zoom, zoom };
}

export default function NotebookPage({ bounds, lines }: { bounds: PageBounds; lines: boolean }) {
  const { x, y, zoom } = useViewport();
  const gap = RULE_GAP * zoom;
  const left = x + bounds.x0 * zoom;
  const width = (bounds.x1 - bounds.x0) * zoom;
  const top = y > 0 ? y : 0;
  // Too dense to be useful (and moire-prone) when zoomed far out.
  const ruled = lines && gap >= 7;
  return (
    <div
      className="notebook-page"
      data-testid="notebook-page"
      aria-hidden="true"
      style={{
        left,
        width,
        top,
        ...(ruled ? { backgroundSize: `100% ${gap}px`, backgroundPosition: `0 ${(y > 0 ? 0 : y) % gap}px` } : {}),
      }}
    >
      {lines && <span className="notebook-margin-line" style={{ left: (MARGIN_LINE_X - bounds.x0) * zoom }} />}
    </div>
  );
}
