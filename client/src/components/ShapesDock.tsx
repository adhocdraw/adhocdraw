// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react";
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import Icon from "./Icon";

interface ShapesDockProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void;
  children: ReactNode;
}

// The Shapes & Widgets panel as a floating dock on the left of the canvas:
// drag its header grip to move it (position remembered in the browser,
// double-click the grip to reset), collapse it to just its title bar, or
// close it (reopen from the toolbar's Shapes button).
export default function ShapesDock({ collapsed, onToggleCollapsed, onClose, children }: ShapesDockProps) {
  const { gripProps, style } = useDraggablePanel("adhocdraw.panelOffset.shapes");
  return (
    <div className={`shapes-dock ${collapsed ? "collapsed" : ""}`} data-draggable-panel style={style}>
      <div className="shapes-dock-header">
        <div {...gripProps}>⠿</div>
        <button
          type="button"
          className="shapes-dock-collapse"
          aria-expanded={!collapsed}
          title={collapsed ? "Expand" : "Collapse"}
          onClick={onToggleCollapsed}
        >
          <span className={`shapes-dock-chevron ${collapsed ? "collapsed" : ""}`}>
            <Icon name="chevron" />
          </span>
          <span className="shapes-dock-title">Shapes &amp; Widgets</span>
        </button>
        <button
          type="button"
          className="shapes-dock-btn shapes-dock-close"
          title="Close"
          aria-label="Close shapes panel"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {!collapsed && <div className="shapes-dock-body">{children}</div>}
    </div>
  );
}
