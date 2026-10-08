// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useReactFlow } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import type { ConnectorStyle } from "../components/EdgeStylePanel";

interface Point {
  x: number;
  y: number;
}

export default function StyledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  markerStart,
  label,
  data,
  selected,
}: EdgeProps) {
  const { setEdges, screenToFlowPosition } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(typeof label === "string" ? label : "");
  const waypoints = ((data as { waypoints?: Point[] } | undefined)?.waypoints ?? []) as Point[];
  const connectorStyle = ((data as { connectorStyle?: ConnectorStyle } | undefined)?.connectorStyle ?? "elbow") as ConnectorStyle;

  const pathArgs = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  const [smoothPath, smoothLabelX, smoothLabelY] =
    connectorStyle === "straight"
      ? getStraightPath(pathArgs)
      : connectorStyle === "curved"
        ? getBezierPath(pathArgs)
        : getSmoothStepPath({ ...pathArgs, borderRadius: 8 });

  const allPoints: Point[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  const hasWaypoints = waypoints.length > 0;
  const edgePath = hasWaypoints ? "M " + allPoints.map((p) => `${p.x},${p.y}`).join(" L ") : smoothPath;
  const labelX = hasWaypoints ? allPoints.reduce((s, p) => s + p.x, 0) / allPoints.length : smoothLabelX;
  const labelY = hasWaypoints ? allPoints.reduce((s, p) => s + p.y, 0) / allPoints.length : smoothLabelY;

  const commit = useCallback(() => {
    setEditing(false);
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label: draft } : e)));
  }, [draft, id, setEdges]);

  const startEditing = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setDraft(typeof label === "string" ? label : "");
      setEditing(true);
    },
    [label]
  );

  // Midpoint dots on a selected edge: pulling one inserts a waypoint into
  // that segment and carries on dragging it, so a bend is added by pulling
  // the line, not by double-clicking (double-click on the line is reserved for
  // the text label). The waypoint is only created once the mouse has actually
  // moved, so a plain click or double-click on the dot adds nothing.
  const pendingMidpointRef = useRef<{ index: number; point: Point; x: number; y: number } | null>(null);

  const startWaypointFromMidpoint = useCallback((event: React.MouseEvent, index: number, point: Point) => {
    event.stopPropagation();
    event.preventDefault();
    pendingMidpointRef.current = { index, point, x: event.clientX, y: event.clientY };
  }, []);

  const removeWaypoint = useCallback(
    (event: React.MouseEvent, index: number) => {
      event.stopPropagation();
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== id) return e;
          const existing = ((e.data as { waypoints?: Point[] } | undefined)?.waypoints ?? []) as Point[];
          return { ...e, data: { ...e.data, waypoints: existing.filter((_, i) => i !== index) } };
        })
      );
    },
    [id, setEdges]
  );

  const draggingIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const pending = pendingMidpointRef.current;
      if (pending && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 3) {
        pendingMidpointRef.current = null;
        setEdges((eds) =>
          eds.map((e) => {
            if (e.id !== id) return e;
            const existing = ((e.data as { waypoints?: Point[] } | undefined)?.waypoints ?? []) as Point[];
            const next = existing.slice();
            next.splice(pending.index, 0, pending.point);
            return { ...e, data: { ...e.data, waypoints: next } };
          })
        );
        draggingIndexRef.current = pending.index;
      }
      const index = draggingIndexRef.current;
      if (index === null) return;
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== id) return e;
          const existing = ((e.data as { waypoints?: Point[] } | undefined)?.waypoints ?? []) as Point[];
          const next = existing.slice();
          next[index] = point;
          return { ...e, data: { ...e.data, waypoints: next } };
        })
      );
    };
    const handleUp = () => {
      pendingMidpointRef.current = null;
      draggingIndexRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [id, screenToFlowPosition, setEdges]);

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} markerStart={markerStart} />
      {/* Wide invisible hit area so double-click (edit label) works
          anywhere along the edge, not just exactly on the thin visible line. */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: "stroke" }}
        onDoubleClick={startEditing}
      />
      {/* Small visible end dots (same size as a shape's resize handles); the
          larger, invisible React Flow reconnect anchor around each one is
          what's actually grabbed, so the dot stays easy to hit. */}
      {selected && (
        <g pointerEvents="none">
          <circle cx={sourceX} cy={sourceY} r={4} className="edge-end-dot" />
          <circle cx={targetX} cy={targetY} r={4} className="edge-end-dot" />
        </g>
      )}
      {selected &&
        (hasWaypoints
          ? allPoints.slice(0, -1).map((p, i) => {
              const q = allPoints[i + 1];
              return { mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, index: i };
            })
          : [{ mid: { x: smoothLabelX, y: smoothLabelY }, index: 0 }]
        ).map(({ mid, index }) => (
          // Drawn inside the edge's own <g> (not the label layer) so a
          // right-click on it still bubbles to the edge's context menu.
          <circle
            key={`mid${index}`}
            cx={mid.x}
            cy={mid.y}
            r={4}
            className="edge-midpoint nodrag nopan"
            onMouseDown={(event) => startWaypointFromMidpoint(event, index, mid)}
            onDoubleClick={startEditing}
          >
            <title>Drag to bend the arrow</title>
          </circle>
        ))}
      <EdgeLabelRenderer>
        {waypoints.map((wp, i) => (
          <div
            key={i}
            className="edge-waypoint nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${wp.x}px, ${wp.y}px)` }}
            onMouseDown={(event) => {
              event.stopPropagation();
              draggingIndexRef.current = i;
            }}
            onDoubleClick={(event) => removeWaypoint(event, i)}
            title="Drag to move, double-click to remove"
          />
        ))}
        <div
          className="edge-label-wrapper"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onDoubleClick={startEditing}
        >
          {editing ? (
            <input
              autoFocus
              className="edge-label-input nodrag nopan"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") setEditing(false);
              }}
              onClick={(event) => event.stopPropagation()}
            />
          ) : label ? (
            <div className="edge-label-text">{label}</div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
