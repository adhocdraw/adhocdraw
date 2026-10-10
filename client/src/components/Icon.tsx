// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

// Small stroke icons for the toolbar, drawn in the current text color so
// they follow light/dark mode. Decorative: the button's text is its label.
const PATHS = {
  newDiagram: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M12 12v6M9 15h6" />
    </>
  ),
  shapes: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <circle cx="17" cy="7" r="4" />
      <path d="M12 14l5 8H7z" />
    </>
  ),
  select: (
    <>
      <path d="M5 3h2M11 3h2M17 3h2v2M19 9v2M19 15v2h-2M13 19h-2M7 19H5v-2M5 13v-2M5 7V5" strokeDasharray="0" />
      <path d="M12 12l7 3-3 1.5L14.5 20z" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </>
  ),
  pencil: (
    <>
      <path d="M17 3l4 4L8 20l-5 1 1-5z" />
      <path d="M14 6l4 4" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="M21 16l-5-5-9 9" />
    </>
  ),
  vector: (
    <>
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="5" r="2" />
      <path d="M6.5 17.5C9 10 14 14 17.5 6.5" />
    </>
  ),
  pdf: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 15h2a1.5 1.5 0 0 0 0-3H8v6" />
    </>
  ),
  save: (
    <>
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M7 3v5h8V3M7 21v-7h10v7" />
    </>
  ),
  blankChart: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 9v6M9 12h6" />
    </>
  ),
  whiteboard: (
    <>
      <rect x="3" y="3" width="18" height="13" rx="2" />
      <path d="M7 12l3-3 3 2 4-4M8 21l2-5M16 21l-2-5" />
    </>
  ),
  folder: <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.5-2.2-.5-1.2.3-2.3 1.6-2.3H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3z" />
      <path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01" />
    </>
  ),
  textTool: (
    <>
      <path d="M5 6V4h14v2M12 4v16M9 20h6" />
    </>
  ),
  notebook: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 3v18M12 8h4M12 12h4M12 16h4" />
      <path d="M3 7h3M3 12h3M3 17h3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  hand: (
    <>
      <path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7" />
      <path d="M17 11.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.7-2.3L5 15.2a1.6 1.6 0 0 1 2.3-2.2L8 13.8" />
    </>
  ),
  // Edit in full screen: screen corners around a pencil (distinct from fit-to-screen, which is corners only).
  focusEdit: (
    <>
      <path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8M16 3h3.5A1.5 1.5 0 0 1 21 4.5V8M21 16v3.5a1.5 1.5 0 0 1-1.5 1.5H16M8 21H4.5A1.5 1.5 0 0 1 3 19.5V16" />
      <path d="M9.5 15.5l.7-2.7 5.1-5.1a1.4 1.4 0 0 1 2 2l-5.1 5.1z" />
      <path d="M14 9l2 2" />
    </>
  ),
  // GitHub mark (filled, drawn on a 16x16 grid, scaled up to the 24x24 icon box).
  github: (
    <g transform="scale(1.5)" fill="currentColor" stroke="none">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </g>
  ),
  ruled: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <path d="M8 3v18" strokeWidth="1.4" />
    </>
  ),
  moon: <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 16h6" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-5-5" />
    </>
  ),
  eraser: (
    <>
      <path d="M4.5 13.5l7.6-7.6a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L11 19H7.5l-3-3a2 2 0 0 1 0-2.5z" />
      <path d="M8.5 10l5.5 5.5M11 19h9" />
    </>
  ),
  thickness: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" strokeWidth="3.5" />
      <path d="M4 19h16" strokeWidth="6" />
    </>
  ),
  opacity: (
    <>
      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
      <path d="M12 3v17" />
    </>
  ),
  linestyle: (
    <>
      <path d="M3 17c3-9 5-9 7-3s4 6 11-8" />
    </>
  ),
  present: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M12 16v4M8 20h8M10 8.5l4 2-4 2z" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className={`toolbar-icon icon-${name}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
