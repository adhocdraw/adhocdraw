// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from "react";
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
        className={`flyout-trigger ${open ? "open" : ""}`}
        aria-expanded={open}
        title={title}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && <div className={`flyout-panel ${panelClassName ?? ""}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
