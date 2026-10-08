// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useRef, useState } from "react";
import { NodeResizer, useReactFlow } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { v4 as uuid } from "uuid";

interface Lane {
  id: string;
  label: string;
  size: number;
}

const defaultLanes = (): Lane[] => [
  { id: uuid(), label: "Lane 1", size: 1 },
  { id: uuid(), label: "Lane 2", size: 1 },
];

export default function SwimlaneNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  const [editingLane, setEditingLane] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackLanesRef = useRef<Lane[] | null>(null);
  const orientation = (data as { orientation?: "horizontal" | "vertical" }).orientation ?? "vertical";
  const existingLanes = (data as { lanes?: Lane[] }).lanes;
  if (!existingLanes && !fallbackLanesRef.current) fallbackLanesRef.current = defaultLanes();
  const lanes = existingLanes ?? fallbackLanesRef.current!;
  const autoResize = (data as { autoResize?: boolean }).autoResize ?? false;
  const totalSize = lanes.reduce((s, l) => s + l.size, 0);

  const updateLanes = (next: Lane[]) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, lanes: next } } : n)));
  };

  const renameLane = (laneId: string, label: string) => {
    updateLanes(lanes.map((l) => (l.id === laneId ? { ...l, label } : l)));
  };

  const addLane = () => {
    updateLanes([...lanes, { id: uuid(), label: `Lane ${lanes.length + 1}`, size: 1 }]);
  };

  const removeLane = (laneId: string) => {
    if (lanes.length <= 1) return;
    updateLanes(lanes.filter((l) => l.id !== laneId));
  };

  const toggleAutoResize = () => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, autoResize: !autoResize } } : n)));
  };

  const handleDividerMouseDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const startPos = orientation === "vertical" ? e.clientX : e.clientY;
    const startLanes = lanes.map((l) => ({ ...l }));
    const containerSize = orientation === "vertical" ? container.offsetWidth : container.offsetHeight;
    const onMove = (ev: MouseEvent) => {
      const pos = orientation === "vertical" ? ev.clientX : ev.clientY;
      const deltaFraction = ((pos - startPos) / containerSize) * totalSize;
      const next = startLanes.map((l, i) => {
        if (i === index) return { ...l, size: Math.max(0.2, l.size + deltaFraction) };
        if (i === index + 1) return { ...l, size: Math.max(0.2, l.size - deltaFraction) };
        return l;
      });
      updateLanes(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className={`swimlane-node swimlane-${orientation}`} ref={containerRef}>
      <NodeResizer isVisible={selected} minWidth={240} minHeight={160} />
      {selected && (
        <button
          className={`swimlane-auto-resize ${autoResize ? "active" : ""}`}
          onClick={toggleAutoResize}
          title="Auto-resize to fit contents"
        >
          ⤢
        </button>
      )}
      {lanes.map((lane, i) => (
        <div key={lane.id} className="swimlane-lane" style={{ flex: `${lane.size} 0 0%` }}>
          <div className="swimlane-lane-header" onDoubleClick={() => setEditingLane(lane.id)}>
            {editingLane === lane.id ? (
              <input
                autoFocus
                defaultValue={lane.label}
                onBlur={(e) => {
                  renameLane(lane.id, e.target.value.trim() || lane.label);
                  setEditingLane(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            ) : (
              <span>{lane.label}</span>
            )}
            {lanes.length > 1 && (
              <button className="swimlane-lane-remove" onClick={() => removeLane(lane.id)} title="Remove lane">
                ×
              </button>
            )}
          </div>
          <div className="swimlane-lane-body" />
          {i < lanes.length - 1 && (
            <div
              className={`swimlane-divider swimlane-divider-${orientation} nodrag nopan`}
              onMouseDown={(e) => handleDividerMouseDown(i, e)}
            />
          )}
        </div>
      ))}
      <button className="swimlane-add-lane" onClick={addLane}>
        + Lane
      </button>
    </div>
  );
}
