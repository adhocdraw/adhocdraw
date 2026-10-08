// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import { NodeResizer, useReactFlow } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export default function FrameNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const label = (data as { label?: string }).label ?? "Frame";
  const locked = (data as { locked?: boolean }).locked ?? false;

  const updateLabel = (value: string) => {
    setNodes((nodes) =>
      nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: value } } : n))
    );
  };

  return (
    <div className="frame-node">
      <NodeResizer isVisible={selected && !locked} minWidth={200} minHeight={150} />
      {locked && <span className="node-lock-badge">🔒</span>}
      <div className="frame-node-label" onDoubleClick={() => !locked && setEditing(true)}>
        {editing ? (
          <input
            autoFocus
            defaultValue={label}
            onBlur={(e) => {
              updateLabel(e.target.value);
              setEditing(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        ) : (
          label
        )}
      </div>
    </div>
  );
}
