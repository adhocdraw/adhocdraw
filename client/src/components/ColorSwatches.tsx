// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

// Preset colors offered next to a color picker.
export const FILL_PRESETS = ["#ffffff", "#ffe3e3", "#fff3bf", "#d3f9d8", "#d0ebff", "#f3d9fa"];
export const STROKE_PRESETS = ["#333333", "#e03131", "#f08c00", "#2f9e44", "#1971c2", "#9c36b5"];
// Pencil: black and white first, so the pen is always readable on either backdrop.
export const DRAW_PRESETS = ["#000000", "#ffffff", "#e03131", "#f08c00", "#2f9e44", "#1971c2", "#9c36b5"];

interface ColorSwatchesProps {
  colors: string[];
  value: string;
  label: string;
  onPick: (color: string) => void;
}

export default function ColorSwatches({ colors, value, label, onPick }: ColorSwatchesProps) {
  return (
    <div className="color-swatches" role="group" aria-label={`${label} presets`}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={`color-swatch ${value.toLowerCase() === c ? "active" : ""}`}
          style={{ background: c }}
          title={c}
          aria-label={`${label} ${c}`}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
}
