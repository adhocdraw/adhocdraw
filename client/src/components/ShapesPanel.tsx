// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useRef, useState } from "react";
import type React from "react";
import type { WidgetKind } from "../types";
import type { CustomShape } from "../api";
import { absoluteUrl } from "../api";
import { fuzzyRank } from "../utils/fuzzySearch";

interface ShapesPanelProps {
  onAdd: (kind: WidgetKind) => void;
  customShapes: CustomShape[];
  onAddCustomShape: (id: string) => void;
  onUploadCustomShape: (file: File) => void;
}

const WIDGETS: { key: WidgetKind; icon: string; label: string }[] = [
  { key: "sticky", icon: "🟨", label: "Sticky Note" },
  { key: "text", icon: "T", label: "Text" },
  { key: "frame", icon: "▢", label: "Frame" },
  { key: "swimlane", icon: "▥", label: "Swimlane" },
  { key: "table", icon: "▦", label: "Table" },
  { key: "uml-class", icon: "🏛", label: "UML Class" },
  { key: "rectangle", icon: "▭", label: "Process" },
  { key: "diamond", icon: "◇", label: "Decision" },
  { key: "terminal", icon: "⏺", label: "Start / End" },
  { key: "parallelogram", icon: "▱", label: "Input / Output" },
  { key: "ellipse", icon: "◯", label: "Ellipse" },
  { key: "hexagon", icon: "⬡", label: "Preparation" },
  { key: "trapezoid", icon: "⏢", label: "Manual Operation" },
  { key: "document", icon: "📄", label: "Document" },
  { key: "cylinder", icon: "🛢", label: "Database" },
  { key: "cloud", icon: "☁", label: "Cloud" },
  { key: "server", icon: "🖥", label: "Server" },
  { key: "actor", icon: "👤", label: "Actor / User" },
];

export default function ShapesPanel({
  onAdd,
  customShapes,
  onAddCustomShape,
  onUploadCustomShape,
}: ShapesPanelProps) {
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // A mouse double-clicks a shape to add it; a finger or pen taps it. (A touch
  // double-tap would otherwise add two.)
  const lastPointerType = useRef("mouse");
  const touchLike = () => lastPointerType.current === "touch" || lastPointerType.current === "pen";
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const addHandlers = (add: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      lastPointerType.current = e.pointerType;
    },
    onClick: () => touchLike() && add(),
    onDoubleClick: () => !touchLike() && add(),
    onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && add(),
  });
  const filtered = fuzzyRank(WIDGETS, (w) => w.label, query);
  const filteredCustom = fuzzyRank(customShapes, (s) => s.name, query);

  return (
    <div className="shapes-panel">
      <div className="shapes-hint">{coarse ? "Tap a shape to add it" : "Double-click a shape to add it"}</div>
      <input
        className="shapes-search"
        type="text"
        placeholder="Search shapes"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.svg"
        className="custom-shape-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadCustomShape(file);
          e.target.value = "";
        }}
      />
      <button className="custom-shape-upload-btn" onClick={() => fileInputRef.current?.click()}>
        + Add custom shape
      </button>
      <div className="shapes-grid">
        {filtered.map((w) => (
          <button
            key={w.key}
            className="shape-btn"
            title={coarse ? "Tap to add" : "Double-click to add"}
            aria-label={w.label}
            {...addHandlers(() => onAdd(w.key))}
          >
            <span className="shape-btn-icon">{w.icon}</span>
            <span className="shape-btn-label">{w.label}</span>
          </button>
        ))}
        {filteredCustom.map((s) => (
          <button
            key={s.id}
            className="shape-btn"
            title={coarse ? "Tap to add" : "Double-click to add"}
            aria-label={s.name}
            {...addHandlers(() => onAddCustomShape(s.id))}
          >
            <img className="shape-btn-custom-icon" src={absoluteUrl(s.url)} alt="" />
            <span className="shape-btn-label">{s.name}</span>
          </button>
        ))}
        {filtered.length === 0 && filteredCustom.length === 0 && (
          <div className="shapes-empty">No shapes match "{query}"</div>
        )}
      </div>
    </div>
  );
}
