// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

// Touch screens (iPhone browsers in particular) do not reliably turn a
// double-tap into `dblclick` or a long-press into `contextmenu`. The app uses
// both (edit text, add text, edge labels, right-click menus), so this turns
// the two touch gestures into those same events. Nothing is stored or sent.
// If the browser already fires the native event, the synthetic one is skipped.

const DOUBLE_TAP_MS = 350;
const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10; // px a finger may drift and still count as a tap/press
const NATIVE_WAIT_MS = 60;

interface Tap {
  x: number;
  y: number;
  time: number;
}

export function installTouchGestures(doc: Document = document): () => void {
  let lastTap: Tap | null = null;
  let press: { x: number; y: number; timer: number; id: number; target: EventTarget | null } | null = null;
  let lastNativeDblClick = 0;
  let lastNativeContextMenu = 0;
  let suppressNextClick = false;

  const fire = (target: EventTarget | null, type: "dblclick" | "contextmenu", x: number, y: number) => {
    if (!(target instanceof Element) || !target.isConnected) return;
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: x,
        clientY: y,
        button: type === "contextmenu" ? 2 : 0,
        detail: type === "dblclick" ? 2 : 0,
      })
    );
  };

  const cancelPress = () => {
    if (press) window.clearTimeout(press.timer);
    press = null;
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || !e.isPrimary) {
      cancelPress();
      return;
    }
    cancelPress();
    const { clientX: x, clientY: y, target } = e;
    const started = Date.now();
    const timer = window.setTimeout(() => {
      press = null;
      if (lastNativeContextMenu >= started) return;
      suppressNextClick = true;
      fire(target, "contextmenu", x, y);
    }, LONG_PRESS_MS);
    press = { x, y, timer, id: e.pointerId, target };
  };

  const onMove = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE) cancelPress();
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || !e.isPrimary) return;
    const wasPressing = press && press.id === e.pointerId;
    const start = press;
    cancelPress();
    if (!wasPressing || !start) {
      lastTap = null;
      return;
    }
    const now = Date.now();
    const prev = lastTap;
    if (prev && now - prev.time < DOUBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
      lastTap = null;
      const { clientX: x, clientY: y, target } = e;
      window.setTimeout(() => {
        if (lastNativeDblClick >= now) return;
        fire(target, "dblclick", x, y);
      }, NATIVE_WAIT_MS);
    } else {
      lastTap = { x: e.clientX, y: e.clientY, time: now };
    }
  };

  const onNativeDblClick = (e: MouseEvent) => {
    if (e.isTrusted) lastNativeDblClick = Date.now();
  };
  const onNativeContextMenu = (e: MouseEvent) => {
    if (e.isTrusted) lastNativeContextMenu = Date.now();
  };
  // The finger lifting after a long-press would otherwise also click what is under it.
  const onClickCapture = (e: MouseEvent) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    e.stopPropagation();
    e.preventDefault();
  };

  doc.addEventListener("pointerdown", onDown, true);
  doc.addEventListener("pointermove", onMove, true);
  doc.addEventListener("pointerup", onUp, true);
  doc.addEventListener("pointercancel", cancelPress, true);
  doc.addEventListener("dblclick", onNativeDblClick, true);
  doc.addEventListener("contextmenu", onNativeContextMenu, true);
  doc.addEventListener("click", onClickCapture, true);
  return () => {
    cancelPress();
    doc.removeEventListener("pointerdown", onDown, true);
    doc.removeEventListener("pointermove", onMove, true);
    doc.removeEventListener("pointerup", onUp, true);
    doc.removeEventListener("pointercancel", cancelPress, true);
    doc.removeEventListener("dblclick", onNativeDblClick, true);
    doc.removeEventListener("contextmenu", onNativeContextMenu, true);
    doc.removeEventListener("click", onClickCapture, true);
  };
}
