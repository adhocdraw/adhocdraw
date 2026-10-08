// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export interface ContextMenuAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  return (
    // modal=false: a canvas context menu shouldn't block interaction with
    // the rest of the canvas the way a true modal would (Radix's default
    // installs pointer-events:none on the background while open) - outside
    // click/Escape-to-dismiss, keyboard nav, and ARIA roles all still work
    // the same either way, only the background-blocking changes.
    <DropdownMenu.Root open onOpenChange={(open) => !open && onClose()} modal={false}>
      {/* A zero-size trigger positioned at the click point, rather than a
          real button - Radix's Popper anchors the menu to whatever element
          the trigger renders, so this reproduces the old @floating-ui
          virtual-reference trick while letting Radix own positioning,
          collision avoidance, keyboard navigation, focus trapping, and
          close-on-Escape/outside-click, none of which the hand-rolled
          version had beyond a bare window click listener. */}
      <DropdownMenu.Trigger asChild>
        <span aria-hidden style={{ position: "fixed", left: x, top: y, width: 0, height: 0 }} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="context-menu" side="bottom" align="start" sideOffset={2} collisionPadding={8}>
          {actions.map((action) => (
            <DropdownMenu.Item key={action.label} disabled={action.disabled} onSelect={action.onClick}>
              {action.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
