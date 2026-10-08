// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import { Handle, Position, NodeResizer, useReactFlow } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { getTextStyle } from "./textStyle";
import { DEFAULT_FONT_SIZE } from "./shapeDefaults";
import { resolveFormatColor } from "./formatRule";

const COLORS = ["#fff6a3", "#ffd6e8", "#c9f7c5", "#c5e4f7", "#ffe0b3"];

export default function StickyNoteNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const text = (data as { text?: string; color?: string }).text ?? "";
  const color = resolveFormatColor(data as object) ?? (data as { text?: string; color?: string }).color ?? COLORS[0];
  const textStyle = getTextStyle(data as object, DEFAULT_FONT_SIZE);
  const locked = (data as { locked?: boolean }).locked ?? false;

  const updateData = (patch: Record<string, unknown>) => {
    setNodes((nodes) =>
      nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  };

  return (
    <div
      className="sticky-note"
      style={{ background: color }}
      onDoubleClick={() => !locked && setEditing(true)}
    >
      <NodeResizer isVisible={selected && !locked} minWidth={120} minHeight={100} />
      {locked && <span className="node-lock-badge">🔒</span>}
      <div className="sticky-note-swatches">
        {COLORS.map((c) => (
          <button
            key={c}
            className="swatch"
            style={{ background: c }}
            onClick={(e) => {
              e.stopPropagation();
              updateData({ color: c });
            }}
          />
        ))}
      </div>
      {editing ? (
        <textarea
          autoFocus
          className="sticky-note-textarea"
          defaultValue={text}
          style={textStyle}
          onBlur={(e) => {
            updateData({ text: e.target.value });
            setEditing(false);
          }}
        />
      ) : (
        <div className="sticky-note-text" style={textStyle}>{text || "Double-click to edit"}</div>
      )}
      <Handle type="source" position={Position.Top} id="top" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Left} id="left" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Right} id="right" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectableStart isConnectableEnd />
    </div>
  );
}
