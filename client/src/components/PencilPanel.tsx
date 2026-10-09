// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useDraggablePanel } from "../hooks/useDraggablePanel";
import Icon from "./Icon";
import ColorSwatches, { DRAW_PRESETS } from "./ColorSwatches";

// "auto" = black on a light canvas, white on a dark one (the default).
export const AUTO_PEN = "auto";
export const autoPenColor = (dark: boolean) => (dark ? "#ffffff" : "#000000");

export interface PencilOptions {
  color: string;
  size: number; // stroke width in px
  opacity: number; // 0.1 - 1
  style: "pen" | "uniform"; // pen: width varies with drawing speed
}

export const DEFAULT_PENCIL_OPTIONS: PencilOptions = { color: AUTO_PEN, size: 3, opacity: 1, style: "pen" };

const STORAGE_KEY = "adhocdraw.pencilOptions";

// The pen colour is not kept across page loads - every load starts on Auto
// (black on light, white on dark). A colour you pick lasts for the session,
// including switching between diagrams.
let sessionPenColor = AUTO_PEN;

export function loadPencilOptions(): PencilOptions {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (raw && typeof raw.color === "string" && Number.isFinite(raw.size) && Number.isFinite(raw.opacity)) {
      return {
        color: sessionPenColor,
        size: Math.min(24, Math.max(1, raw.size)),
        opacity: Math.min(1, Math.max(0.1, raw.opacity)),
        style: raw.style === "uniform" ? "uniform" : "pen",
      };
    }
  } catch {
    // unreadable - use the defaults
  }
  return { ...DEFAULT_PENCIL_OPTIONS, color: sessionPenColor };
}

export function savePencilOptions(options: PencilOptions) {
  try {
    sessionPenColor = options.color;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...options, color: AUTO_PEN }));
  } catch {
    // storage unavailable - the choice just won't be remembered
  }
}

interface PencilPanelProps {
  options: PencilOptions;
  onChange: (patch: Partial<PencilOptions>) => void;
  // Drawings currently selected: color/opacity changes apply to them too.
  selectedDrawings?: number;
  // True while the colour follows light/dark mode (options.color is then the resolved colour).
  isAuto?: boolean;
  // White Board only: the notebook ruled lines toggle (shown after the colour options).
  notebookLines?: { on: boolean; onToggle: () => void };
}

// Shown while the Pencil tool is on: colour, thickness, transparency and line
// style for the next strokes. Movable like the other floating panels.
export default function PencilPanel({
  options,
  onChange,
  selectedDrawings = 0,
  isAuto = false,
  notebookLines,
}: PencilPanelProps) {
  const { gripProps, style } = useDraggablePanel("adhocdraw.panelOffset.pencil");
  return (
    <div className="style-panel pencil-panel" data-draggable-panel style={style} aria-label="Pencil options" role="group">
      <div {...gripProps}>⠿</div>
      <ColorSwatches colors={DRAW_PRESETS} value={options.color} label="Color" onPick={(c) => onChange({ color: c })} />
      <button
        type="button"
        className={`pencil-auto ${isAuto ? "active" : ""}`}
        aria-pressed={isAuto}
        title="Automatic colour: black on a light canvas, white on a dark one"
        onClick={() => onChange({ color: AUTO_PEN })}
      >
        Auto
      </button>
      <label className="pencil-field pencil-field-color">
        <span className="pencil-label">Color</span>
        <input
          type="color"
          value={options.color}
          aria-label="Pencil color"
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </label>
      {notebookLines && (
        <button
          type="button"
          className={`pencil-notebook ${notebookLines.on ? "active" : ""}`}
          aria-pressed={notebookLines.on}
          aria-label="Notebook lines"
          title="Notebook lines: show or hide ruled lines on the white board"
          onClick={notebookLines.onToggle}
        >
          <Icon name="ruled" />
          <span className="pencil-text">Notebook lines</span>
        </button>
      )}
      <label className="pencil-field" title="Thickness">
        <span className="pencil-label">Thickness</span>
        <span className="pencil-label-icon"><Icon name="thickness" /></span>
        <input
          type="range"
          min={1}
          max={24}
          value={options.size}
          aria-label="Pencil thickness"
          onChange={(e) => onChange({ size: Number(e.target.value) })}
        />
        <span className="pencil-value">{options.size}px</span>
      </label>
      <label className="pencil-field" title="Opacity">
        <span className="pencil-label">Opacity</span>
        <span className="pencil-label-icon"><Icon name="opacity" /></span>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={Math.round(options.opacity * 100)}
          aria-label="Pencil opacity"
          onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
        />
        <span className="pencil-value">{Math.round(options.opacity * 100)}%</span>
      </label>
      <label className="pencil-field" title="Line style">
        <span className="pencil-label">Line</span>
        <span className="pencil-label-icon"><Icon name="linestyle" /></span>
        <select
          value={options.style}
          aria-label="Pencil line style"
          onChange={(e) => onChange({ style: e.target.value === "uniform" ? "uniform" : "pen" })}
        >
          <option value="pen">Pen (varies with speed)</option>
          <option value="uniform">Uniform</option>
        </select>
      </label>
      {selectedDrawings > 0 && (
        <span className="pencil-hint" role="status">
          Color and opacity also apply to the {selectedDrawings} selected drawing{selectedDrawings > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
