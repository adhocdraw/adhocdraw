// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

export type ShapeKind =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "terminal"
  | "parallelogram"
  | "cylinder"
  | "cloud"
  | "document"
  | "actor"
  | "server"
  | "hexagon"
  | "trapezoid";

export type WidgetKind = "sticky" | "text" | "frame" | "swimlane" | "table" | "uml-class" | ShapeKind;
