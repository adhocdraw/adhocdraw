// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import type { CSSProperties } from "react";

export interface TextStyleData {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontFamily?: string;
}

export function getTextStyle(data: TextStyleData, defaultFontSize: number): CSSProperties {
  return {
    fontSize: data.fontSize ?? defaultFontSize,
    fontWeight: data.bold ? "bold" : "normal",
    fontStyle: data.italic ? "italic" : "normal",
    textDecoration: data.underline ? "underline" : "none",
    fontFamily: data.fontFamily || undefined,
  };
}

export const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Comic Sans MS", value: "'Comic Sans MS', cursive" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
];
