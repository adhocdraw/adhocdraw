// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { Fragment } from "react";
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import Icon from "./Icon";
import type { IconName } from "./Icon";

interface Tool {
  key: string;
  icon: IconName;
  // Short, unique accessible name (the toolbar already has the full-text buttons).
  label: string;
  tip: string;
  active: boolean;
  onClick: () => void;
  // A thin divider before this button (to set it apart from the drawing tools).
  separatorBefore?: boolean;
  // A divider after this button (e.g. after undo/redo).
  separatorAfter?: boolean;
  // Momentary actions (undo/redo) are not toggles: no pressed state.
  disabled?: boolean;
}

interface ToolsPanelProps {
  tools: Tool[];
}

// A floating, draggable tools panel (icons only) with the same choices as the
// toolbar's Draw group, like the pencil palette but always available.
export default function ToolsPanel({ tools }: ToolsPanelProps) {
  const { gripProps, style } = useDraggablePanel("adhocdraw.panelOffset.tools");
  return (
    <div className="tools-panel" data-draggable-panel style={style} role="group" aria-label="Tool panel">
      <div {...gripProps}>⠿</div>
      {tools.map((t) => (
        <Fragment key={t.key}>
          {t.separatorBefore && <span className="tools-sep" aria-hidden="true" />}
        <button
          type="button"
          className={`tool-panel-btn tool-panel-${t.key} ${t.active ? "active" : ""}`}
          aria-pressed={t.disabled === undefined ? t.active : undefined}
          disabled={t.disabled}
          aria-label={t.label}
          data-tip={t.tip}
          onClick={t.onClick}
        >
          <Icon name={t.icon} />
        </button>
          {t.separatorAfter && <span className="tools-sep" aria-hidden="true" />}
        </Fragment>
      ))}
    </div>
  );
}
