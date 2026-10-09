// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ReactNode } from "react";

interface FlyoutProps {
  label: ReactNode;
  children: (close: () => void) => ReactNode;
  panelClassName?: string;
  title?: string;
  // Accessible name for when the visible label is hidden (narrow toolbar).
  ariaLabel?: string;
}

// A toolbar button that opens a small dropdown panel beneath it; closes on
// Escape, on a click anywhere outside it, or when the panel's contents call
// the `close` they're handed.
export default function Flyout({ label, children, panelClassName, title, ariaLabel }: FlyoutProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The panel is placed against the window, not inside the toolbar: on a phone the
  // toolbar scrolls sideways and would otherwise clip (or hide) the menu.
  const [pos, setPos] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) {
      setPos(undefined);
      return;
    }
    const place = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      const w = panelRef.current?.offsetWidth ?? 0;
      if (!t) return;
      const left = Math.max(8, Math.min(t.left, window.innerWidth - w - 8));
      setPos({ position: "fixed", top: t.bottom + 6, left, maxHeight: Math.max(120, window.innerHeight - t.bottom - 16) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleDown, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="flyout" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`flyout-trigger ${open ? "open" : ""}`}
        aria-expanded={open}
        title={title}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div ref={panelRef} className={`flyout-panel ${panelClassName ?? ""}`} style={pos}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
