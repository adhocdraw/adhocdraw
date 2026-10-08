// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

interface ShortcutsHelpProps {
  onClose: () => void;
}

const SHORTCUTS: [string, string][] = [
  ["Ctrl/Cmd + Z", "Undo"],
  ["Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y", "Redo"],
  ["Ctrl/Cmd + C", "Copy selection"],
  ["Ctrl/Cmd + V", "Paste"],
  ["Ctrl/Cmd + D", "Duplicate selection"],
  ["Ctrl/Cmd + S", "Save to file"],
  ["Ctrl/Cmd + A", "Select all"],
  ["Arrow keys", "Nudge selected node(s) by 1px"],
  ["Shift + Arrow keys", "Nudge selected node(s) by 10px"],
  ["]", "Bring selection to front"],
  ["[", "Send selection to back"],
  ["Ctrl/Cmd + =", "Zoom in"],
  ["Ctrl/Cmd + -", "Zoom out"],
  ["Delete / Backspace", "Delete selection"],
  ["Shift + drag", "Marquee select"],
  ["Ctrl/Cmd + G", "Group selection"],
  ["Ctrl/Cmd + Shift + G", "Ungroup"],
  ["Ctrl/Cmd + F", "Find / Replace"],
  ["T", "Text tool: click the canvas and type"],
  ["H", "Hand tool: drag the canvas to move around"],
  ["F", "Focus mode on a White Board or Notebook: edit full screen"],
  ["F2", "Rename the open diagram"],
  ["Double-click empty canvas", "Add text there and type"],
  ["?", "Toggle this shortcuts panel"],
  ["Escape", "Close menus / this panel"],
];

export default function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2>Keyboard shortcuts</h2>
          <button className="shortcuts-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <ul className="shortcuts-list">
          {SHORTCUTS.map(([keys, desc]) => (
            <li key={keys}>
              <kbd>{keys}</kbd>
              <span>{desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
