// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef, useState } from "react";
import { Handle, Position, NodeResizer, useReactFlow } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { ShapeKind } from "../types";
import { getTextStyle } from "./textStyle";
import { DEFAULT_FONT_SIZE, MIN_SHAPE_SIZE } from "./shapeDefaults";
import { resolveFormatColor } from "./formatRule";

// 30% thinner than the original 3 / 4 outlines (in the SVG viewBox units the
// icons are drawn in).
const SVG_STROKE = 2.1;
const SVG_STROKE_THICK = 2.8;

const CSS_SHAPE_STYLE: Partial<Record<ShapeKind, React.CSSProperties>> = {
  rectangle: { borderRadius: 8 },
  ellipse: { borderRadius: "50%" },
  diamond: { clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" },
  terminal: { borderRadius: 999 },
  parallelogram: { clipPath: "polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)" },
  hexagon: { clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" },
  trapezoid: { clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)" },
};

const SVG_SHAPES: Partial<Record<ShapeKind, (color: string, stroke: string) => React.ReactNode>> = {
  cylinder: (color, stroke) => (
    // viewBox is cropped to the path's own ink extents (not a generic
    // 0 0 200 120 canvas) so that, combined with preserveAspectRatio="none",
    // the drawn shape stretches all the way to the node's four edges -
    // exactly where the top/left/right/bottom connection handles sit.
    // A generic canvas left empty margin around the shape, which put those
    // handles visibly outside the drawn silhouette (issue: edges appeared
    // to float away from the shape instead of touching it).
    <svg viewBox="10 4 180 112" preserveAspectRatio="none" className="shape-svg">
      <path
        d="M10,22 A90,18 0 0 1 190,22 L190,98 A90,18 0 0 1 10,98 Z"
        fill={color}
        stroke={stroke}
        strokeWidth={SVG_STROKE}
      />
      <path d="M10,22 A90,18 0 0 0 190,22" fill="none" stroke={stroke} strokeWidth={SVG_STROKE} />
    </svg>
  ),
  cloud: (color, stroke) => (
    <svg viewBox="15 8 170 82" preserveAspectRatio="none" className="shape-svg">
      <path
        d="M50,90 C25,90 15,65 32,52 C25,32 50,15 72,22 C82,8 115,8 128,25 C155,20 175,42 165,60 C185,65 182,90 160,90 Z"
        fill={color}
        stroke={stroke}
        strokeWidth={SVG_STROKE}
      />
    </svg>
  ),
  document: (color, stroke) => (
    <svg viewBox="10 10 180 98" preserveAspectRatio="none" className="shape-svg">
      <path
        d="M10,10 L190,10 L190,88 C165,108 155,72 130,88 C105,104 95,68 70,88 C45,108 35,72 10,88 Z"
        fill={color}
        stroke={stroke}
        strokeWidth={SVG_STROKE}
      />
    </svg>
  ),
  actor: (color, stroke) => (
    <svg viewBox="18 6 64 109" preserveAspectRatio="none" className="shape-svg">
      <circle cx="50" cy="20" r="14" fill={color} stroke={stroke} strokeWidth={SVG_STROKE_THICK} />
      <line x1="50" y1="34" x2="50" y2="78" stroke={stroke} strokeWidth={SVG_STROKE_THICK} strokeLinecap="round" />
      <line x1="18" y1="50" x2="82" y2="50" stroke={stroke} strokeWidth={SVG_STROKE_THICK} strokeLinecap="round" />
      <line x1="50" y1="78" x2="22" y2="115" stroke={stroke} strokeWidth={SVG_STROKE_THICK} strokeLinecap="round" />
      <line x1="50" y1="78" x2="78" y2="115" stroke={stroke} strokeWidth={SVG_STROKE_THICK} strokeLinecap="round" />
    </svg>
  ),
  server: (color, stroke) => (
    <svg viewBox="10 8 180 104" preserveAspectRatio="none" className="shape-svg">
      <rect x="10" y="8" width="180" height="28" rx="4" fill={color} stroke={stroke} strokeWidth={SVG_STROKE} />
      <circle cx="26" cy="22" r="5" fill={stroke} />
      <rect x="10" y="46" width="180" height="28" rx="4" fill={color} stroke={stroke} strokeWidth={SVG_STROKE} />
      <circle cx="26" cy="60" r="5" fill={stroke} />
      <rect x="10" y="84" width="180" height="28" rx="4" fill={color} stroke={stroke} strokeWidth={SVG_STROKE} />
      <circle cx="26" cy="98" r="5" fill={stroke} />
    </svg>
  ),
};

export default function ShapeNode({ id, data, selected }: NodeProps) {
  const { setNodes, getNode } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const shape = (data as { shape?: ShapeKind }).shape ?? "rectangle";
  const text = (data as { text?: string }).text ?? "";
  const color = resolveFormatColor(data as object) ?? (data as { color?: string }).color ?? "#e8ebff";
  const strokeColor = (data as { strokeColor?: string }).strokeColor ?? "#6b7fd7";
  const textStyle = getTextStyle(data as object, DEFAULT_FONT_SIZE);
  const svgRenderer = SVG_SHAPES[shape];
  const locked = (data as { locked?: boolean }).locked ?? false;
  const contentRef = useRef<HTMLDivElement>(null);
  // Tracks the height this component itself last committed via setNodes,
  // so a re-measure can tell "content still needs what I already gave it"
  // apart from "content needs more than before" without comparing against
  // the DOM's own clientHeight - see the effect below for why that
  // distinction matters.
  const lastAppliedHeightRef = useRef<number | null>(null);

  const updateData = (patch: Record<string, unknown>) => {
    setNodes((nodes) =>
      nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  };

  // The shape's own box never clips or scrolls its text (see App.css) - a
  // shape with more text than fits should grow taller to show all of it,
  // rather than hiding lines or squeezing the drawn shape away. This grows
  // the node's own style.height to fit whenever content needs more room.
  // It only grows, never shrinks - deleting text back down doesn't shrink
  // the node back on its own, the same way an auto-expanding textarea
  // wouldn't. Skipped while the textarea is open, since edit mode has its
  // own fixed-height editor.
  //
  // The content's natural height is measured by briefly clearing its own
  // height (letting it size to content) rather than reading clientHeight,
  // which is pinned to whatever height we last gave the node - comparing
  // scrollHeight against that self-referential clientHeight is what
  // caused an infinite update loop here previously: any sub-pixel rounding
  // gap between the two never resolves no matter how many times you "fix"
  // it, since both numbers move together.
  useLayoutEffect(() => {
    if (editing) return;
    const content = contentRef.current;
    if (!content) return;
    const measure = () => {
      const prevHeight = content.style.height;
      content.style.height = "auto";
      const natural = content.scrollHeight;
      content.style.height = prevHeight;
      if (lastAppliedHeightRef.current === natural) return;
      const node = getNode(id);
      const current =
        node?.measured?.height ?? (typeof node?.style?.height === "number" ? node.style.height : 0);
      if (natural > current + 0.5) {
        lastAppliedHeightRef.current = natural;
        setNodes((nds) =>
          nds.map((n) => (n.id === id ? { ...n, style: { ...n.style, height: natural } } : n))
        );
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [id, editing, text, textStyle, shape, setNodes, getNode]);

  const textEditor = editing ? (
    <textarea
      autoFocus
      className="shape-node-textarea"
      defaultValue={text}
      style={textStyle}
      onBlur={(e) => {
        updateData({ text: e.target.value });
        setEditing(false);
      }}
    />
  ) : (
    <div className="shape-node-text" style={textStyle}>{text}</div>
  );

  return (
    <div className="shape-node-wrapper" onDoubleClick={() => !locked && setEditing(true)}>
      {/* lineStyle hides the resizer's own boundary lines - every shape here
          already draws its own correctly-shaped, colored border (the CSS
          clip-path or SVG stroke below), so the resizer's rectangle was a
          second, shape-mismatched outline on top of it (a diamond or
          ellipse got a rectangular selection box around it). The resize
          handles themselves are kept - they still need to sit at the
          bounding-box corners/edges to work. */}
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={MIN_SHAPE_SIZE.width}
        minHeight={MIN_SHAPE_SIZE.height}
        lineStyle={{ opacity: 0 }}
      />
      {locked && <span className="node-lock-badge">🔒</span>}
      {svgRenderer ? (
        <div className="shape-node shape-node-svg" ref={contentRef}>
          {svgRenderer(color, strokeColor)}
          <div className="shape-node-svg-label">{textEditor}</div>
        </div>
      ) : (
        <div
          className="shape-node"
          ref={contentRef}
          style={{ ...CSS_SHAPE_STYLE[shape], background: color, borderColor: strokeColor }}
        >
          {textEditor}
        </div>
      )}
      <Handle type="source" position={Position.Top} id="top" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Left} id="left" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Right} id="right" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectableStart isConnectableEnd />
    </div>
  );
}
