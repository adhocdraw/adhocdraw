// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import { NodeResizer, useReactFlow } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

const defaultRows = (): string[][] => [
  ["", ""],
  ["", ""],
];

export default function TableNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(null);
  const rows = ((data as { rows?: string[][] }).rows ?? defaultRows()) as string[][];
  const locked = (data as { locked?: boolean }).locked ?? false;
  const colCount = rows[0]?.length ?? 2;

  const updateRows = (next: string[][]) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, rows: next } } : n)));
  };

  const setCell = (r: number, c: number, value: string) => {
    const next = rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row));
    updateRows(next);
  };

  const addRow = () => updateRows([...rows, Array(colCount).fill("")]);
  const removeRow = () => rows.length > 1 && updateRows(rows.slice(0, -1));
  const addColumn = () => updateRows(rows.map((row) => [...row, ""]));
  const removeColumn = () => colCount > 1 && updateRows(rows.map((row) => row.slice(0, -1)));

  return (
    <div className="table-node-wrapper">
      <NodeResizer isVisible={selected && !locked} minWidth={120} minHeight={80} />
      {locked && <span className="node-lock-badge">🔒</span>}
      <div className="table-node" style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
        {rows.map((row, r) =>
          row.map((cell, c) =>
            editing && editing.row === r && editing.col === c ? (
              <textarea
                key={`${r}-${c}`}
                autoFocus
                className="table-node-cell-input"
                defaultValue={cell}
                onBlur={(e) => {
                  setCell(r, c, e.target.value);
                  setEditing(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && e.currentTarget.blur()}
              />
            ) : (
              <div
                key={`${r}-${c}`}
                className="table-node-cell"
                onDoubleClick={() => !locked && setEditing({ row: r, col: c })}
              >
                {cell}
              </div>
            )
          )
        )}
      </div>
      {selected && !locked && (
        <div className="table-node-controls nodrag nopan">
          <button onClick={addRow} title="Add row">
            + Row
          </button>
          <button onClick={removeRow} title="Remove row" disabled={rows.length <= 1}>
            - Row
          </button>
          <button onClick={addColumn} title="Add column">
            + Col
          </button>
          <button onClick={removeColumn} title="Remove column" disabled={colCount <= 1}>
            - Col
          </button>
        </div>
      )}
    </div>
  );
}
