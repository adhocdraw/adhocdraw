// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { Handle, Position, NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export default function FreehandNode({ data, selected }: NodeProps) {
  const pathD = (data as { pathD?: string }).pathD ?? "";
  const viewBox = (data as { viewBox?: string }).viewBox ?? "0 0 100 100";
  const strokeColor = (data as { strokeColor?: string }).strokeColor ?? "#333333";
  const strokeWidth = (data as { strokeWidth?: number }).strokeWidth ?? 3;
  const opacity = (data as { opacity?: number }).opacity ?? 1;
  const locked = (data as { locked?: boolean }).locked ?? false;
  // Strokes drawn since the perfect-freehand migration (T2) store a filled,
  // variable-width outline polygon in `pathD` and render as a solid shape.
  // Strokes from before that (no `smoothed` flag) are a plain polyline
  // through the raw captured points and still need the old stroke-only
  // rendering - filling one of those would auto-close and fill the jagged
  // raw path, not what it looked like when drawn.
  const smoothed = (data as { smoothed?: boolean }).smoothed ?? false;
  // Strokes drawn with the Auto pen colour follow light/dark mode (black on a
  // light canvas, white on a dark one) instead of keeping the colour they were
  // drawn in; see .freehand-auto in App.css.
  const auto = (data as { autoColor?: boolean }).autoColor === true;
  const paint = auto ? "currentColor" : strokeColor;

  return (
    <div className={`freehand-node-wrapper${auto ? " freehand-auto" : ""}`}>
      <NodeResizer isVisible={selected && !locked} minWidth={30} minHeight={30} />
      {locked && <span className="node-lock-badge">🔒</span>}
      <svg className="freehand-node-svg" viewBox={viewBox} preserveAspectRatio="none">
        {smoothed ? (
          <path d={pathD} fill={paint} fillOpacity={opacity} stroke="none" />
        ) : (
          <path d={pathD} fill="none" stroke={paint} strokeOpacity={opacity} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <Handle type="source" position={Position.Top} id="top" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Left} id="left" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Right} id="right" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectableStart isConnectableEnd />
    </div>
  );
}
