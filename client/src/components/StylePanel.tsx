// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import type { Node } from "@xyflow/react";
import { FONT_FAMILIES } from "../nodes/textStyle";
import { DEFAULT_FONT_SIZE } from "../nodes/shapeDefaults";
import ColorSwatches, { FILL_PRESETS, STROKE_PRESETS } from "./ColorSwatches";
import { useDraggablePanel } from "../hooks/useDraggablePanel";

interface StylePanelProps {
  nodes: Node[];
  onChange: (patch: Record<string, unknown>) => void;
}

export default function StylePanel({ nodes, onChange }: StylePanelProps) {
  const { gripProps, style } = useDraggablePanel("adhocdraw.panelOffset.textStyle");
  if (nodes.length === 0) return null;

  const first = nodes[0].data as {
    color?: string;
    strokeColor?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontFamily?: string;
  };
  const color = first.color ?? "#e8ebff";
  const strokeColor = first.strokeColor ?? "#6b7fd7";
  const fontSize = first.fontSize ?? DEFAULT_FONT_SIZE;
  const bold = first.bold ?? false;
  const italic = first.italic ?? false;
  const underline = first.underline ?? false;
  const fontFamily = first.fontFamily ?? "";

  // A selection of only pencil drawings has no fill, text or fonts - just the
  // line's color and opacity, the same choices the Pencil panel offers.
  if (nodes.every((n) => n.type === "freehand")) {
    const drawingColor = (first as { strokeColor?: string }).strokeColor ?? "#333333";
    const drawingOpacity = (first as { opacity?: number }).opacity ?? 1;
    return (
      <div className="style-panel" data-draggable-panel style={style}>
        <div {...gripProps}>⠿</div>
        <ColorSwatches colors={STROKE_PRESETS} value={drawingColor} label="Drawing color" onPick={(c) => onChange({ strokeColor: c, autoColor: false })} />
        <label>
          Color
          <input
            type="color"
            value={drawingColor}
            aria-label="Drawing color"
            onChange={(e) => onChange({ strokeColor: e.target.value, autoColor: false })}
          />
        </label>
        <label>
          Opacity
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(drawingOpacity * 100)}
            aria-label="Drawing opacity"
            onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
          />
          <span className="pencil-value">{Math.round(drawingOpacity * 100)}%</span>
        </label>
      </div>
    );
  }

  return (
    <div className="style-panel" data-draggable-panel style={style}>
      <div {...gripProps}>⠿</div>
      <label>
        Fill
        <input
          type="color"
          value={color}
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </label>
      <ColorSwatches colors={FILL_PRESETS} value={color} label="Fill" onPick={(c) => onChange({ color: c })} />
      <label>
        Stroke
        <input
          type="color"
          value={strokeColor}
          onChange={(e) => onChange({ strokeColor: e.target.value })}
        />
      </label>
      <ColorSwatches colors={STROKE_PRESETS} value={strokeColor} label="Stroke" onPick={(c) => onChange({ strokeColor: c })} />
      <label>
        Font size
        <input
          type="number"
          min={10}
          max={72}
          value={fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
        />
      </label>
      <div className="text-format-toggles">
        <button
          type="button"
          className={`text-toggle-btn ${bold ? "active" : ""}`}
          title="Bold"
          onClick={() => onChange({ bold: !bold })}
        >
          B
        </button>
        <button
          type="button"
          className={`text-toggle-btn italic ${italic ? "active" : ""}`}
          title="Italic"
          onClick={() => onChange({ italic: !italic })}
        >
          I
        </button>
        <button
          type="button"
          className={`text-toggle-btn underline ${underline ? "active" : ""}`}
          title="Underline"
          onClick={() => onChange({ underline: !underline })}
        >
          U
        </button>
      </div>
      <label>
        Font
        <select value={fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
