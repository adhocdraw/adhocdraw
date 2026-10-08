// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

// Fit-to-screen never zooms in past 100%: a diagram with only a few small
// shapes should stay at its natural size instead of being blown up to fill the
// whole window.
export const FIT_VIEW_OPTIONS = { maxZoom: 1, padding: 0.2 };

// How far the user can zoom out / in (React Flow's own limits are 0.5 - 2).
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

// The zoom buttons (and Ctrl/Cmd + / -) move between these levels instead of by
// a fixed factor: 100, 110, 125, 150, 175, 200 ... going in, and the mirror image
// going out. (The mouse wheel and pinch still zoom smoothly.)
export const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5].filter(
  (z) => z >= MIN_ZOOM && z <= MAX_ZOOM
);

// The next level above (direction 1) or below (-1) the current zoom.
export function nextZoom(current: number, direction: 1 | -1): number {
  const EPS = 0.005;
  if (direction === 1) return ZOOM_STEPS.find((z) => z > current + EPS) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((z) => z < current - EPS) ?? MIN_ZOOM;
}

// Like nextZoom, but quick repeated clicks build on the level the previous click
// is still animating towards (rather than on the half-way zoom it passes through).
let pendingStep: { value: number; at: number } | null = null;
export function stepZoom(current: number, direction: 1 | -1): number {
  const now = Date.now();
  const base = pendingStep && now - pendingStep.at < 400 ? pendingStep.value : current;
  const value = nextZoom(base, direction);
  pendingStep = { value, at: now };
  return value;
}
