// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import type { Edge } from "@xyflow/react";

export type LineStyle = "solid" | "dashed" | "dotted";
export type ArrowHead =
  | "none"
  | "arrow"
  | "arrowclosed"
  | "circle"
  | "crow-one"
  | "crow-many"
  | "crow-zero-one"
  | "crow-zero-many";
export type ConnectorStyle = "elbow" | "straight" | "curved" | "smart";

interface EdgeStylePanelProps {
  edges: Edge[];
  onChange: (patch: {
    lineStyle?: LineStyle;
    arrowHead?: ArrowHead;
    startArrowHead?: ArrowHead;
    connectorStyle?: ConnectorStyle;
    label?: string;
  }) => void;
}

function MarkerOptions() {
  return (
    <>
      <option value="none">None</option>
      <option value="arrow">Open arrow</option>
      <option value="arrowclosed">Closed arrow</option>
      <option value="circle">Circle</option>
      <option value="crow-one">Crow's foot: one</option>
      <option value="crow-many">Crow's foot: many</option>
      <option value="crow-zero-one">Crow's foot: zero or one</option>
      <option value="crow-zero-many">Crow's foot: zero or many</option>
    </>
  );
}

export default function EdgeStylePanel({ edges, onChange }: EdgeStylePanelProps) {
  if (edges.length === 0) return null;

  const first = edges[0].data as
    | { lineStyle?: LineStyle; arrowHead?: ArrowHead; startArrowHead?: ArrowHead; connectorStyle?: ConnectorStyle }
    | undefined;
  const lineStyle = first?.lineStyle ?? "solid";
  const arrowHead = first?.arrowHead ?? "arrowclosed";
  const startArrowHead = first?.startArrowHead ?? "none";
  const connectorStyle = first?.connectorStyle ?? "elbow";
  const label = typeof edges[0].label === "string" ? edges[0].label : "";

  return (
    <div className="style-panel edge-style-panel">
      <label>
        Connector
        <select value={connectorStyle} onChange={(e) => onChange({ connectorStyle: e.target.value as ConnectorStyle })}>
          <option value="elbow">Elbow</option>
          <option value="straight">Straight</option>
          <option value="curved">Curved</option>
          <option value="smart">Smart (routes around nodes)</option>
        </select>
      </label>
      <label>
        Line
        <select value={lineStyle} onChange={(e) => onChange({ lineStyle: e.target.value as LineStyle })}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </label>
      <label>
        Start
        <select value={startArrowHead} onChange={(e) => onChange({ startArrowHead: e.target.value as ArrowHead })}>
          <MarkerOptions />
        </select>
      </label>
      <label>
        End
        <select value={arrowHead} onChange={(e) => onChange({ arrowHead: e.target.value as ArrowHead })}>
          <MarkerOptions />
        </select>
      </label>
      <label>
        Label
        <input
          type="text"
          placeholder="Edge label"
          defaultValue={label}
          onBlur={(e) => onChange({ label: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </label>
    </div>
  );
}
