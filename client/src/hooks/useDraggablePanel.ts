// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

interface Offset {
  x: number;
  y: number;
}

const ZERO: Offset = { x: 0, y: 0 };
const PANEL_SELECTOR = "[data-draggable-panel], .react-flow__controls";

function load(key: string): Offset {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return ZERO;
    const parsed = JSON.parse(raw);
    if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return { x: parsed.x, y: parsed.y };
  } catch {
    // Unreadable or blocked storage - fall back to the default spot.
  }
  return ZERO;
}

function save(key: string, offset: Offset) {
  try {
    if (offset.x === 0 && offset.y === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(offset));
  } catch {
    // Storage unavailable (private mode, quota) - the position just won't persist.
  }
}

// A floating panel keeps its default CSS position; the user's chosen spot is
// stored as an offset from that default (so the default still adapts to the
// window size) in localStorage under `storageKey`. Drag the element carrying
// `gripProps`; double-click it to snap back to the default. The panel root
// must carry `data-draggable-panel`, and `style` must be applied to it.
export function useDraggablePanel(storageKey: string) {
  const [offset, setOffset] = useState<Offset>(() => load(storageKey));
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const dragRef = useRef<{ startX: number; startY: number; base: Offset; minX: number; maxX: number; minY: number; maxY: number } | null>(
    null
  );
  const panelRef = useRef<HTMLElement | null>(null);

  const clampIntoView = useCallback(() => {
    const panel = panelRef.current;
    const parent = panel?.offsetParent as HTMLElement | null;
    if (!panel || !parent || !panel.isConnected) return;
    const p = panel.getBoundingClientRect();
    const c = parent.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (p.left < c.left) dx = c.left - p.left;
    else if (p.right > c.right) dx = c.right - p.right;
    if (p.top < c.top) dy = c.top - p.top;
    else if (p.bottom > c.bottom) dy = c.bottom - p.bottom;
    if (dx || dy) setOffset({ x: offsetRef.current.x + dx, y: offsetRef.current.y + dy });
  }, []);

  // A saved spot from a bigger window (or a smaller panel) shouldn't leave the
  // panel stranded off-screen.
  useEffect(() => {
    window.addEventListener("resize", clampIntoView);
    return () => window.removeEventListener("resize", clampIntoView);
  }, [clampIntoView]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const panel = (e.currentTarget as HTMLElement).closest(PANEL_SELECTOR) as HTMLElement | null;
    const parent = panel?.offsetParent as HTMLElement | null;
    if (!panel || !parent) return;
    e.preventDefault();
    e.stopPropagation();
    panelRef.current = panel;
    const p = panel.getBoundingClientRect();
    const c = parent.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      base: offsetRef.current,
      minX: c.left - p.left,
      maxX: c.right - p.right,
      minY: c.top - p.top,
      maxY: c.bottom - p.bottom,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = Math.min(Math.max(e.clientX - d.startX, d.minX), Math.max(d.minX, d.maxX));
    const dy = Math.min(Math.max(e.clientY - d.startY, d.minY), Math.max(d.minY, d.maxY));
    setOffset({ x: d.base.x + dx, y: d.base.y + dy });
  }, []);

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      save(storageKey, offsetRef.current);
    },
    [storageKey]
  );

  const reset = useCallback(() => {
    setOffset(ZERO);
    save(storageKey, ZERO);
  }, [storageKey]);

  // The grip is a child of the panel, so it can find the panel root once it
  // mounts and clamp a saved position that no longer fits.
  const gripRef = useCallback(
    (el: HTMLElement | null) => {
      panelRef.current = (el?.closest(PANEL_SELECTOR) as HTMLElement | null) ?? null;
      if (el) requestAnimationFrame(clampIntoView);
    },
    [clampIntoView]
  );

  const gripProps = {
    ref: gripRef,
    className: "panel-grip nopan nodrag",
    title: "Drag to move this panel (double-click to reset)",
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onDoubleClick: reset,
  };

  // The CSS `translate` property composes with a panel's own `transform`
  // (the style panel is centered with translateX(-50%)), so it can sit on top
  // of the default position without replacing it.
  const style: CSSProperties | undefined =
    offset.x !== 0 || offset.y !== 0 ? { translate: `${offset.x}px ${offset.y}px` } : undefined;
  return { gripProps, style };
}
