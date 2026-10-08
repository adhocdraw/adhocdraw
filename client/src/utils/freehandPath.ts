// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { getStroke } from "perfect-freehand";

interface Point {
  x: number;
  y: number;
}

// Turns perfect-freehand's outline points (an array of [x, y] pairs tracing
// the stroke's variable-width silhouette) into a single closed SVG path
// using quadratic beziers through the midpoints of each segment - the
// standard technique from perfect-freehand's own docs for a smooth curve
// rather than a faceted polygon.
function getSvgPathFromStroke(points: number[][]): string {
  if (points.length === 0) return "";
  const d = points.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", points[0][0], points[0][1], "Q"] as (string | number)[]
  );
  return d.join(" ") + " Z";
}

// Converts a raw list of pointer-move points (in flow coordinates) into a
// smoothed, variable-width stroke outline - replacing the old plain
// polyline through every captured point, which looked angular and uneven
// especially when the pointer moved quickly (fewer samples per distance
// covered). Returns the outline as a filled SVG path (already offset by
// `pad` so the caller can drop it straight into a `0 0 width height`
// viewBox) plus the flow-space position and size of the padded bounding
// box - the smoothed stroke extends `size / 2` beyond the raw points, so
// this must be measured from the outline, not the input points.
// `thinning` 0.5 makes the line vary with drawing speed (pen); 0 keeps it a
// uniform width.
export function computeSmoothedFreehandPath(points: Point[], size: number, pad: number, thinning = 0.5) {
  const outline = getStroke(points, { size, thinning, smoothing: 0.5, streamline: 0.5 });
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const paddedOutline = outline.map(([x, y]) => [x - minX + pad, y - minY + pad]);
  return {
    pathD: getSvgPathFromStroke(paddedOutline),
    position: { x: minX - pad, y: minY - pad },
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}
