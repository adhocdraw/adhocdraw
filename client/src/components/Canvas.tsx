// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ReactFlow,
  Background,
  MiniMap,
  BackgroundVariant,
  MarkerType,
  ConnectionMode,
  ConnectionLineType,
  addEdge,
  reconnectEdge,
  applyNodeChanges,
  getNodesBounds,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useViewport,
  ReactFlowProvider,
} from "@xyflow/react";
import type { Connection, Edge, Node, NodeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng, toSvg } from "html-to-image";
import jsPDF from "jspdf";
import { fileSave } from "browser-fs-access";
import type { FileWithHandle } from "browser-fs-access";
import { v4 as uuid } from "uuid";
import { nodeTypes } from "../nodes";
import StyledEdge from "../edges/StyledEdge";
import Flyout from "./Flyout";
import Icon from "./Icon";
import { DEFAULT_ACTOR_SIZE, DEFAULT_SHAPE_SIZE } from "../nodes/shapeDefaults";
import ZoomControls from "./ZoomControls";
import { createPortal } from "react-dom";
import NotebookRules from "./NotebookRules";
import ToolsPanel from "./ToolsPanel";
import Logo from "./Logo";
import { openRepo, SITE_URL } from "../links";
import { NotebookLinesContext } from "../contexts/NotebookLinesContext";
import { FIT_VIEW_OPTIONS, MAX_ZOOM, MIN_ZOOM, stepZoom } from "./zoomOptions";
import ShapesDock from "./ShapesDock";
import PencilPanel, { AUTO_PEN, autoPenColor, loadPencilOptions, savePencilOptions } from "./PencilPanel";
import type { PencilOptions } from "./PencilPanel";
import ShapesPanel from "./ShapesPanel";
import { api, isPagedData } from "../api";
import { fingerprint } from "../fingerprint";
import type { PageData, CustomShape } from "../api";
import type { WidgetKind } from "../types";
import StylePanel from "./StylePanel";
import EdgeStylePanel from "./EdgeStylePanel";
import type { ArrowHead, ConnectorStyle, LineStyle } from "./EdgeStylePanel";
import ContextMenu from "./ContextMenu";
import ShortcutsHelp from "./ShortcutsHelp";
import VersionHistoryPanel from "./VersionHistoryPanel";
import AlignPanel from "./AlignPanel";
import FindReplacePanel from "./FindReplacePanel";
import DataPanel from "./DataPanel";
import { useNodeAnchoredFloating } from "../hooks/useNodeAnchoredFloating";
import { useToast } from "../contexts/ToastContext";
import { computeSmoothedFreehandPath } from "../utils/freehandPath";
import { computeSmartRoute } from "../utils/smartRouting";
import type { Diagram } from "../api";
import type { ContextMenuAction } from "./ContextMenu";

interface CanvasProps {
  diagramId: string;
  // Called once a diagram's data is loaded.
  onLoaded?: (info: { whiteboard: boolean }) => void;
  onSaved: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  theme: "classic" | "palette";
  onToggleTheme: () => void;
  pencilActive: boolean;
  onExitPencilMode: () => void;
  onTogglePencil: () => void;
  handModeActive: boolean;
  onExitHandMode: () => void;
  onToggleHandMode: () => void;
  textToolActive: boolean;
  onExitTextTool: () => void;
  onToggleTextTool: () => void;
  selectModeActive: boolean;
  onExitSelectMode: () => void;
  onToggleSelectMode: () => void;
  onSaveStatusChange?: (status: SaveStatus) => void;
  needsFileSave?: boolean;
  onOpenAbout?: () => void;
  leadingActions?: ReactNode;
  diagramTabs?: ReactNode;
  fileHandle: FileWithHandle["handle"];
  onFileHandleChange: (handle: FileWithHandle["handle"]) => void;
}

export interface CanvasHandle {
  addNode: (kind: WidgetKind) => void;
  uploadCustomShape: (file: File) => Promise<void>;
  addCustomShapeNode: (customShapeId: string) => void;
  rename: (name: string) => void;
}

export type SaveStatus = "saved" | "saving" | "unsaved";
type Snapshot = { nodes: Node[]; edges: Edge[] };
type ContextMenuState = { x: number; y: number; type: "node" | "edge"; id: string };

const DEFAULT_EDGE_OPTIONS = {
  type: "styled",
  pathOptions: { borderRadius: 8 },
  style: { strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed },
};

const edgeTypes = { styled: StyledEdge };

const CONNECTION_LINE_STYLE = { strokeWidth: 2, stroke: "#5b6ee1" };
const HISTORY_DEBOUNCE_MS = 400;
const HISTORY_LIMIT = 50;
// Minimap thumbnails use each node's own fill / outline so the overview shows
// what is where, instead of one grey for everything.
const MINIMAP_FALLBACK_FILL: Record<string, string> = {
  sticky: "#ffe066",
  frame: "#c8cde0",
  swimlane: "#c8cde0",
  group: "#c8cde0",
  freehand: "#555b75",
};
// Dark pen colours vanish on the dark minimap, so lighten them there.
const miniMapPen = (d: { color?: string; strokeColor?: string; autoColor?: boolean }, dark: boolean) => {
  if (d.autoColor) return dark ? "#ffffff" : "#000000";
  const c = d.color ?? d.strokeColor ?? MINIMAP_FALLBACK_FILL.freehand;
  return dark ? `color-mix(in srgb, ${c} 35%, #ffffff)` : c;
};
const miniMapNodeColor = (n: Node, dark: boolean) => {
  const d = n.data as { color?: string; strokeColor?: string };
  // A freehand stroke's box is mostly empty: a faint tint, not a solid block.
  if (n.type === "freehand") {
    return `color-mix(in srgb, ${miniMapPen(d, dark)} 18%, transparent)`;
  }
  return d.color ?? MINIMAP_FALLBACK_FILL[n.type ?? ""] ?? "#e8ebff";
};
const miniMapNodeStroke = (n: Node, dark: boolean) => {
  const d = n.data as { strokeColor?: string; color?: string };
  if (n.type === "freehand") return miniMapPen(d, dark);
  return d.strokeColor ?? (n.type === "sticky" ? "#d4a800" : "#6b7fd7");
};

const GRID_SIZE = 16;
// Notebook ruled lines are this far apart (canvas units); text sits between them.
const RULE_GAP = 32;
const TEXT_BOX_HEIGHT = 32;
// Things on top of the canvas that a pencil stroke must never start on.
// Zoom of a new, empty diagram on a phone.
const PHONE_START_ZOOM = 0.25;

const NOT_DRAWABLE_SELECTOR = [
  ".react-flow__controls",
  ".react-flow__minimap",
  ".react-flow__panel",
  ".style-panel",
  ".edge-style-panel",
  ".align-panel",
  ".find-replace-panel",
  ".shapes-dock",
  ".page-tabs",
  ".tools-panel",
  ".context-menu",
  ".link-popover",
  ".comment-popover",
  ".data-panel",
  "button",
  "input",
  "select",
  "textarea",
  "label",
].join(",");
const FILE_SAVE_NUDGE_MS = 5 * 60 * 1000;
const AUTO_VERSION_EVERY_N_SAVES = 10;
const GUIDE_THRESHOLD = 6;

const cloneSnapshot = (nodes: Node[], edges: Edge[]): Snapshot =>
  JSON.parse(JSON.stringify({ nodes, edges }));

const getNodeRect = (node: Node) => {
  const width = node.measured?.width ?? (typeof node.style?.width === "number" ? node.style.width : 150);
  const height = node.measured?.height ?? (typeof node.style?.height === "number" ? node.style.height : 100);
  return { x: node.position.x, y: node.position.y, width, height };
};

const isFullyInside = (
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number }
) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const reorderByParent = (nds: Node[]): Node[] => {
  const withoutParent = nds.filter((n) => !n.parentId);
  const withParent = nds.filter((n) => n.parentId);
  return [...withoutParent, ...withParent];
};

// Frame, Group, and Swimlane all act as drop-target containers (a node
// dropped fully inside one gets parented to it, same reparent/unparent
// mechanics). They differ only in delete semantics (see removedFrameIds
// below) and visual chrome.
const isContainerType = (type?: string) => type === "frame" || type === "group" || type === "swimlane";

// Grows a container (Frame/Swimlane with autoResize enabled) to keep all of
// its children fully inside, shifting the container's own position (and
// compensating children's relative positions) if it needed to grow toward
// the top-left. No-ops if the container doesn't need to grow or doesn't
// have autoResize on.
const growContainerToFit = (nds: Node[], parentId: string): Node[] => {
  const parent = nds.find((n) => n.id === parentId);
  if (!parent || !(parent.data as { autoResize?: boolean }).autoResize) return nds;
  const MARGIN = 24;
  const children = nds.filter((n) => n.parentId === parentId);
  if (children.length === 0) return nds;
  const parentRect = getNodeRect(parent);
  let minX = 0;
  let minY = 0;
  let maxX = parentRect.width;
  let maxY = parentRect.height;
  children.forEach((c) => {
    const r = getNodeRect(c);
    minX = Math.min(minX, r.x - MARGIN);
    minY = Math.min(minY, r.y - MARGIN);
    maxX = Math.max(maxX, r.x + r.width + MARGIN);
    maxY = Math.max(maxY, r.y + r.height + MARGIN);
  });
  if (minX === 0 && minY === 0 && maxX === parentRect.width && maxY === parentRect.height) return nds;
  const newWidth = maxX - minX;
  const newHeight = maxY - minY;
  return nds.map((n) => {
    if (n.id === parentId) {
      return {
        ...n,
        position: { x: parent.position.x + minX, y: parent.position.y + minY },
        style: { ...n.style, width: newWidth, height: newHeight },
      };
    }
    if (n.parentId === parentId) {
      return { ...n, position: { x: n.position.x - minX, y: n.position.y - minY } };
    }
    return n;
  });
};

const snapPosition = (pos: { x: number; y: number }) => ({
  x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE,
});

const cloneNodesAndEdges = (
  sourceNodes: Node[],
  sourceEdges: Edge[],
  offset: number
): { newNodes: Node[]; newEdges: Edge[] } => {
  const idMap = new Map<string, string>();
  const newNodes = sourceNodes.map((n) => {
    const newId = uuid();
    idMap.set(n.id, newId);
    return {
      ...n,
      id: newId,
      parentId: undefined,
      position: { x: n.position.x + offset, y: n.position.y + offset },
      selected: true,
    };
  });
  const newEdges = sourceEdges.map((e) => ({
    ...e,
    id: uuid(),
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
    selected: true,
  }));
  return { newNodes, newEdges };
};

const CROW_MARKER_IDS: Partial<Record<ArrowHead, string>> = {
  "crow-one": "adhocdraw-crow-one",
  "crow-many": "adhocdraw-crow-many",
  "crow-zero-one": "adhocdraw-crow-zero-one",
  "crow-zero-many": "adhocdraw-crow-zero-many",
};

const markerFor = (arrowHead: ArrowHead) => {
  if (arrowHead === "none") return undefined;
  if (arrowHead === "circle") return "adhocdraw-circle-marker";
  if (CROW_MARKER_IDS[arrowHead]) return CROW_MARKER_IDS[arrowHead];
  return { type: arrowHead === "arrow" ? MarkerType.Arrow : MarkerType.ArrowClosed };
};

const edgeStyleFromPatch = (
  existingData: Record<string, unknown>,
  patch: {
    lineStyle?: LineStyle;
    arrowHead?: ArrowHead;
    startArrowHead?: ArrowHead;
    connectorStyle?: ConnectorStyle;
    label?: string;
  }
) => {
  const data = { ...existingData, ...patch };
  const lineStyle = (data.lineStyle as LineStyle | undefined) ?? "solid";
  const arrowHead = (data.arrowHead as ArrowHead | undefined) ?? "arrowclosed";
  const startArrowHead = (data.startArrowHead as ArrowHead | undefined) ?? "none";
  const strokeDasharray = lineStyle === "dashed" ? "8,6" : lineStyle === "dotted" ? "2,4" : undefined;
  const markerEnd = markerFor(arrowHead);
  const markerStart = markerFor(startArrowHead);
  return { data, strokeDasharray, markerEnd, markerStart };
};

const CanvasInner = forwardRef<CanvasHandle, CanvasProps>(function CanvasInner(
  {
    diagramId,
    onLoaded,
    onSaved,
    darkMode,
    onToggleDarkMode,
    theme,
    onToggleTheme,
    pencilActive,
    onExitPencilMode,
    onTogglePencil,
    handModeActive,
    onExitHandMode,
    onToggleHandMode,
    textToolActive,
    onExitTextTool,
    onToggleTextTool,
    selectModeActive,
    onExitSelectMode,
    onToggleSelectMode,
    onSaveStatusChange,
    needsFileSave = false,
    onOpenAbout,
    leadingActions,
    diagramTabs,
    fileHandle,
    onFileHandleChange,
  },
  ref
) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  // The Shapes & Widgets dock: open by default on charts, closed by default on
  // White Boards and Notebooks. Each kind remembers its own choice in the browser.
  const readShapesPanel = (key: string, fallback: { open: boolean; collapsed: boolean }) => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      if (raw && typeof raw.open === "boolean" && typeof raw.collapsed === "boolean") return raw as typeof fallback;
    } catch {
      // unreadable - fall through to the default
    }
    return fallback;
  };
  // On a phone the Shapes dock starts collapsed to a slim bar (no saved choice yet).
  const isPhone = () => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 600px)").matches;
  // Live version of the same query, for things that must appear/disappear as the screen changes.
  const [phoneView, setPhoneView] = useState(isPhone);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 600px)");
    const onChange = () => setPhoneView(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const shapesPanelKeyRef = useRef("adhocdraw.shapesPanel");
  const [shapesPanel, setShapesPanelState] = useState<{ open: boolean; collapsed: boolean }>(() =>
    readShapesPanel("adhocdraw.shapesPanel", { open: true, collapsed: isPhone() })
  );
  // Not shown until the diagram has loaded and we know which kind it is (no flash
  // of the wrong default).
  const [panelsReady, setPanelsReady] = useState(false);
  const setShapesPanel = (update: (p: { open: boolean; collapsed: boolean }) => { open: boolean; collapsed: boolean }) =>
    setShapesPanelState((prev) => {
      const next = update(prev);
      try {
        localStorage.setItem(shapesPanelKeyRef.current, JSON.stringify(next));
      } catch {
        // storage unavailable - just won't be remembered
      }
      return next;
    });
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const autosaveCountRef = useRef(0);
  const [guides, setGuides] = useState<{ vertical: number[]; horizontal: number[] }>({ vertical: [], horizontal: [] });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [linkEditingId, setLinkEditingId] = useState<string | null>(null);
  const [dataEditingId, setDataEditingId] = useState<string | null>(null);
  const commentFloating = useNodeAnchoredFloating(noteEditingId);
  const linkFloating = useNodeAnchoredFloating(linkEditingId);
  const dataFloating = useNodeAnchoredFloating(dataEditingId, "bottom-end");
  const [presenting, setPresenting] = useState(false);
  // Focus mode: edit a White Board / Notebook full screen (a fixed overlay like
  // presentation mode, but with the tools, palette, zoom and page panels kept).
  const [focusMode, setFocusMode] = useState(false);
  const [pages, setPages] = useState<{ id: string; name: string }[]>([]);
  const [activePageId, setActivePageId] = useState<string>("");
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState("");
  const [customShapes, setCustomShapes] = useState<CustomShape[]>([]);
  const [background, setBackground] = useState<"dots" | "plain" | "lines">("dots");
  const backgroundRef = useRef<"dots" | "plain" | "lines">("dots");
  const kindRef = useRef<"whiteboard" | "notebook" | undefined>(undefined);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Content for pages that are NOT the currently-active one (the active
  // page's nodes/edges live in the `nodes`/`edges` state above, same as
  // before multi-page support existed).
  const pageContentRef = useRef<Record<string, { nodes: Node[]; edges: Edge[]; viewport?: { x: number; y: number; zoom: number } }>>(
    {}
  );
  const { getNodes, deleteElements, zoomTo, getZoom, setViewport, getViewport, fitView, screenToFlowPosition } =
    useReactFlow();
  const viewport = useViewport();
  // Latest fitView for effects that must not re-run when its identity changes.
  const fitViewRef = useRef(fitView);
  fitViewRef.current = fitView;

  const saveToFileRef = useRef<() => void>(() => {});
  const [pencilOptions, setPencilOptions] = useState<PencilOptions>(loadPencilOptions);
  // The pen colour actually used: "auto" follows light/dark mode.
  const penColor = pencilOptions.color === AUTO_PEN ? autoPenColor(darkMode) : pencilOptions.color;
  const updatePencilOptions = (patch: Partial<PencilOptions>) => {
    setPencilOptions((prev) => {
      const next = { ...prev, ...patch };
      savePencilOptions(next);
      return next;
    });
    // Color and opacity are also applied to any drawings already selected
    // (thickness and line style are baked into a finished stroke's outline).
    const onDrawings: Record<string, unknown> = {};
    if (patch.color !== undefined) {
      onDrawings.strokeColor = patch.color === AUTO_PEN ? autoPenColor(darkMode) : patch.color;
      onDrawings.autoColor = patch.color === AUTO_PEN;
    }
    if (patch.opacity !== undefined) onDrawings.opacity = patch.opacity;
    if (Object.keys(onDrawings).length > 0) {
      setNodes((nds) =>
        nds.map((n) => (n.selected && n.type === "freehand" ? { ...n, data: { ...n.data, ...onDrawings } } : n))
      );
    }
  };
  // After a long stretch with work that is not in a file, give the Save to
  // file button one extra, brief pulse (never a continuous animation).
  const [nudgeFileSave, setNudgeFileSave] = useState(false);
  useEffect(() => {
    setNudgeFileSave(false);
    if (!needsFileSave) return;
    const t = setTimeout(() => setNudgeFileSave(true), FILE_SAVE_NUDGE_MS);
    return () => clearTimeout(t);
  }, [needsFileSave]);
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  // The undo/redo refs are not reactive; this mirrors "is there anything to undo/redo" into
  // state so the tools-panel buttons can enable and disable themselves.
  const [historyFlags, setHistoryFlags] = useState({ undo: false, redo: false });
  const syncHistory = useCallback(() => {
    const undo = pastRef.current.length > 0;
    const redo = futureRef.current.length > 0;
    setHistoryFlags((f) => (f.undo === undo && f.redo === redo ? f : { undo, redo }));
  }, []);
  const lastStableRef = useRef<Snapshot>({ nodes: [], edges: [] });
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHistoryActionRef = useRef(false);
  const clipboardRef = useRef<Snapshot>({ nodes: [], edges: [] });
  const styleClipboardRef = useRef<Record<string, unknown> | null>(null);

  const customShapesRef = useRef<CustomShape[]>([]);
  useEffect(() => {
    customShapesRef.current = customShapes;
  }, [customShapes]);

  useEffect(() => {
    loadedRef.current = false;
    api.get(diagramId).then((diagram) => {
      const data = diagram.data;
      let loadedPages: PageData[];
      if (isPagedData(data) && data.pages.length > 0) {
        loadedPages = data.pages;
      } else {
        const flat = data as { nodes?: Node[]; edges?: Edge[] };
        loadedPages = [{ id: uuid(), name: "Page 1", nodes: flat.nodes ?? [], edges: flat.edges ?? [] }];
      }
      const content: typeof pageContentRef.current = {};
      loadedPages.forEach((p) => {
        content[p.id] = { nodes: p.nodes, edges: p.edges, viewport: p.viewport };
      });
      pageContentRef.current = content;
      setPages(loadedPages.map((p) => ({ id: p.id, name: p.name })));
      setActivePageId(loadedPages[0].id);
      setCustomShapes(isPagedData(data) ? (data.customShapes ?? []) : []);
      const loadedBackground =
        isPagedData(data) && (data.background === "plain" || data.background === "lines") ? data.background : "dots";
      backgroundRef.current = loadedBackground;
      kindRef.current = isPagedData(data) ? data.kind : undefined;
      const board =
        kindRef.current === "whiteboard" ||
        kindRef.current === "notebook" ||
        (kindRef.current === undefined && loadedBackground !== "dots");
      shapesPanelKeyRef.current = board ? "adhocdraw.shapesPanel.board" : "adhocdraw.shapesPanel";
      setShapesPanelState(
        readShapesPanel(shapesPanelKeyRef.current, board ? { open: false, collapsed: false } : { open: true, collapsed: isPhone() })
      );
      setPanelsReady(true);
      setBackground(loadedBackground);
      // A White Board opens ready to draw, also when it is reloaded.
      onLoadedRef.current?.({ whiteboard: loadedBackground !== "dots" });
      setName(diagram.name);
      setNodes(loadedPages[0].nodes);
      setEdges(loadedPages[0].edges);
      lastStableRef.current = cloneSnapshot(loadedPages[0].nodes, loadedPages[0].edges);
      pastRef.current = [];
      futureRef.current = [];
      syncHistory();
      setSaveStatus("saved");
      loadedRef.current = true;
      autosaveCountRef.current = 0;
      if (loadedPages[0].viewport) {
        setViewport(loadedPages[0].viewport);
      } else if (loadedPages[0].nodes.length > 0) {
        // Never opened before (e.g. created from a template): frame what is
        // there. Done here, once, rather than via React Flow's fitView prop -
        // that one also fires the first time an empty canvas gets a node, which
        // yanked the first thing drawn on a new diagram to the center.
        setTimeout(() => fitViewRef.current(FIT_VIEW_OPTIONS), 50);
      } else if (isPhone()) {
        // An empty diagram on a phone starts zoomed out, so there is room to work.
        setViewport({ x: 0, y: 0, zoom: PHONE_START_ZOOM });
      }
    });
  }, [diagramId, setNodes, setEdges, setViewport]);

  // Restoring a version replaces the current canvas content; pushing the
  // pre-restore state onto the undo stack first makes the restore itself
  // undoable, per the version-history acceptance criteria.
  const handleRestored = useCallback(
    (diagram: Diagram) => {
      pastRef.current.push(cloneSnapshot(nodes, edges));
      futureRef.current = [];
      syncHistory();
      const data = diagram.data;
      let restoredPages: PageData[];
      if (isPagedData(data) && data.pages.length > 0) {
        restoredPages = data.pages;
      } else {
        const flat = data as { nodes?: Node[]; edges?: Edge[] };
        restoredPages = [{ id: uuid(), name: "Page 1", nodes: flat.nodes ?? [], edges: flat.edges ?? [] }];
      }
      const content: typeof pageContentRef.current = {};
      restoredPages.forEach((p) => {
        content[p.id] = { nodes: p.nodes, edges: p.edges, viewport: p.viewport };
      });
      pageContentRef.current = content;
      setPages(restoredPages.map((p) => ({ id: p.id, name: p.name })));
      setActivePageId(restoredPages[0].id);
      setNodes(restoredPages[0].nodes);
      setEdges(restoredPages[0].edges);
      lastStableRef.current = cloneSnapshot(restoredPages[0].nodes, restoredPages[0].edges);
      isHistoryActionRef.current = true;
      setHistoryOpen(false);
    },
    [nodes, edges, setNodes, setEdges]
  );

  // Reads the viewport imperatively (rather than the reactive `viewport`
  // value from useViewport()) so this doesn't change identity on every pan/
  // zoom render tick - that instability was feeding into the autosave
  // effect's dependencies and starving its debounce, so saves never settled.
  const buildPagesData = useCallback((): PageData[] => {
    return pages.map((p) => {
      if (p.id === activePageId) {
        return { id: p.id, name: p.name, nodes, edges, viewport: getViewport() };
      }
      const cached = pageContentRef.current[p.id];
      return { id: p.id, name: p.name, nodes: cached?.nodes ?? [], edges: cached?.edges ?? [], viewport: cached?.viewport };
    });
  }, [pages, activePageId, nodes, edges, getViewport]);

  const scheduleSave = useCallback(
    (nextName: string) => {
      if (!loadedRef.current) return;
      setSaveStatus("unsaved");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        saveTimer.current = null;
        setSaveStatus("saving");
        await api.update(diagramId, {
          name: nextName,
          data: { pages: buildPagesData(), customShapes: customShapesRef.current, background: backgroundRef.current, kind: kindRef.current },
        });
        setSaveStatus("saved");
        onSaved();
        autosaveCountRef.current += 1;
        if (autosaveCountRef.current % AUTO_VERSION_EVERY_N_SAVES === 0) {
          api.saveVersion(diagramId, "Auto").catch(() => {});
        }
      }, 600);
    },
    [diagramId, onSaved, buildPagesData]
  );

  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [saveStatus, onSaveStatusChange]);

  // Switching to another diagram tab unmounts this canvas; an edit still
  // waiting out its autosave delay would otherwise be dropped, so write it
  // out right away instead.
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (!saveTimer.current || !loadedRef.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    api
      .update(diagramId, {
        name,
        data: { pages: buildPagesData(), customShapes: customShapesRef.current, background: backgroundRef.current, kind: kindRef.current },
      })
      .then(() => onSaved())
      .catch(() => {});
  };
  useEffect(() => () => flushRef.current(), []);

  // On a phone the browser can freeze or discard the page the moment you switch
  // apps, so an edit still waiting out its 600 ms autosave delay is written out as
  // soon as the page is hidden or closed.
  useEffect(() => {
    const flushNow = () => flushRef.current();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    scheduleSave(name);
    // `scheduleSave`'s identity changes whenever `onSaved` does (a new
    // inline function from the parent on every render it triggers), and
    // deliberately isn't a dep here - including it re-fires this effect
    // after every completed save, resetting status back to "unsaved" and
    // rescheduling forever. Only real content/name changes should trigger a
    // new save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, pages, name, customShapes, background]);

  // Full-screen presentation of the pages (toolbar and footer buttons).
  const startPresentation = () => {
    setPresenting(true);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    setTimeout(() => fitView({ duration: 300, maxZoom: 2 }), 0);
  };

  // White Board: show or hide the notebook ruled lines.
  const toggleNotebookLines = () => {
    const next = background === "lines" ? "plain" : "lines";
    backgroundRef.current = next;
    setBackground(next);
  };

  // The footer's zoom slot: the zoom controls render into it (a portal keeps them
  // inside React Flow's context while sitting in the footer).
  const [footerZoomEl, setFooterZoomEl] = useState<HTMLDivElement | null>(null);
  // A White Board is one endless page: no paging there. (Older boards have no
  // `kind`; a plain/ruled backdrop marks them.)
  const isWhiteboard = kindRef.current === "whiteboard" || (kindRef.current === undefined && background !== "dots");
  // White Boards and Notebooks (also older boards with a plain/ruled backdrop and no
  // `kind`) get the floating tools panel; charts do not.
  const isBoard =
    kindRef.current === "whiteboard" ||
    kindRef.current === "notebook" ||
    (kindRef.current === undefined && background !== "dots");
  // The floating tools panel: always on boards; on a phone also on charts, where it takes
  // the place of the toolbar's Draw group.
  const showToolsPanel = isBoard || phoneView;
  const isBoardRef = useRef(false);
  isBoardRef.current = isBoard;

  const switchToPage = useCallback(
    (targetId: string) => {
      if (targetId === activePageId) return;
      pageContentRef.current[activePageId] = { nodes, edges, viewport: getViewport() };
      const target = pageContentRef.current[targetId] ?? { nodes: [], edges: [] };
      setActivePageId(targetId);
      setNodes(target.nodes);
      setEdges(target.edges);
      lastStableRef.current = cloneSnapshot(target.nodes, target.edges);
      pastRef.current = [];
      futureRef.current = [];
      syncHistory();
      // A node-anchored popover left open across a page switch would keep
      // pointing at an id that no longer exists in the new page's nodes -
      // close it rather than leave it dangling.
      setNoteEditingId(null);
      setLinkEditingId(null);
      setDataEditingId(null);
      if (target.viewport) {
        setViewport(target.viewport);
      } else {
        fitView(FIT_VIEW_OPTIONS);
      }
    },
    [activePageId, nodes, edges, getViewport, setNodes, setEdges, setViewport, fitView]
  );

  const addPage = useCallback(() => {
    const id = uuid();
    pageContentRef.current[activePageId] = { nodes, edges, viewport: getViewport() };
    pageContentRef.current[id] = { nodes: [], edges: [] };
    setPages((prev) => [...prev, { id, name: `Page ${prev.length + 1}` }]);
    setActivePageId(id);
    setNodes([]);
    setEdges([]);
    lastStableRef.current = cloneSnapshot([], []);
    pastRef.current = [];
    futureRef.current = [];
      syncHistory();
    setNoteEditingId(null);
    setLinkEditingId(null);
    setDataEditingId(null);
    fitView(FIT_VIEW_OPTIONS);
  }, [activePageId, nodes, edges, getViewport, setNodes, setEdges, fitView]);

  const renamePage = useCallback((id: string, newName: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)));
  }, []);

  const deletePage = useCallback(
    (id: string) => {
      setPages((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((p) => p.id === id);
        const next = prev.filter((p) => p.id !== id);
        delete pageContentRef.current[id];
        if (id === activePageId) {
          const fallback = next[Math.max(0, idx - 1)];
          const content = pageContentRef.current[fallback.id] ?? { nodes: [], edges: [] };
          setActivePageId(fallback.id);
          setNodes(content.nodes);
          setEdges(content.edges);
          lastStableRef.current = cloneSnapshot(content.nodes, content.edges);
          pastRef.current = [];
          futureRef.current = [];
      syncHistory();
          setNoteEditingId(null);
          setLinkEditingId(null);
          setDataEditingId(null);
          if (content.viewport) setViewport(content.viewport);
        }
        return next;
      });
    },
    [activePageId, setNodes, setEdges, setViewport]
  );

  // Page tabs are reordered by dragging: drop one before/after another.
  const [dragPageId, setDragPageId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; after: boolean } | null>(null);
  // The tab nearest the pointer (and which side of it), ignoring the dragged tab,
  // so a drop between tabs, in the gaps or past the last tab still lands somewhere.
  const pageDropTarget = (list: HTMLElement, clientX: number, dragId: string) => {
    const tabs = Array.from(list.querySelectorAll<HTMLElement>("[data-page-id]")).filter(
      (el) => el.dataset.pageId !== dragId
    );
    if (tabs.length === 0) return null;
    let best: { id: string; after: boolean; dist: number } | null = null;
    for (const el of tabs) {
      const r = el.getBoundingClientRect();
      const after = clientX > r.left + r.width / 2;
      const dist = Math.abs(clientX - (r.left + r.width / 2));
      if (!best || dist < best.dist) best = { id: el.dataset.pageId!, after, dist };
    }
    return best ? { id: best.id, after: best.after } : null;
  };
  const reorderPage = useCallback((id: string, targetId: string, after: boolean) => {
    setPages((prev) => {
      const from = prev.findIndex((p) => p.id === id);
      const to = prev.findIndex((p) => p.id === targetId);
      if (from === -1 || to === -1 || id === targetId) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      const targetIdx = next.findIndex((p) => p.id === targetId);
      next.splice(after ? targetIdx + 1 : targetIdx, 0, moved);
      return next.every((p, i) => p.id === prev[i].id) ? prev : next;
    });
  }, []);

  // Undo/redo history: coalesce rapid changes into one entry per pause.
  useEffect(() => {
    if (!loadedRef.current) return;
    if (isHistoryActionRef.current) {
      isHistoryActionRef.current = false;
      lastStableRef.current = cloneSnapshot(nodes, edges);
      return;
    }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      const prev = lastStableRef.current;
      const current = cloneSnapshot(nodes, edges);
      if (JSON.stringify(prev) !== JSON.stringify(current)) {
        pastRef.current.push(prev);
        if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
        futureRef.current = [];
      syncHistory();
        lastStableRef.current = current;
      }
    }, HISTORY_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const previous = pastRef.current.pop()!;
    futureRef.current.push(cloneSnapshot(nodes, edges));
    syncHistory();
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    isHistoryActionRef.current = true;
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    pastRef.current.push(cloneSnapshot(nodes, edges));
    syncHistory();
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    isHistoryActionRef.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [nodes, edges, setNodes, setEdges]);

  const copySelection = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const ids = new Set(selected.map((n) => n.id));
    const relevantEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    clipboardRef.current = cloneSnapshot(selected, relevantEdges);
  }, [nodes, edges]);

  const pasteClipboard = useCallback(() => {
    const { nodes: clipNodes, edges: clipEdges } = clipboardRef.current;
    if (clipNodes.length === 0) return;
    const { newNodes, newEdges } = cloneNodesAndEdges(clipNodes, clipEdges, 40);
    setNodes((nds) => nds.map((n): Node => ({ ...n, selected: false })).concat(newNodes));
    setEdges((eds) => eds.map((e): Edge => ({ ...e, selected: false })).concat(newEdges));
  }, [setNodes, setEdges]);

  const duplicateSelection = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const ids = new Set(selected.map((n) => n.id));
    const relevantEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    const { newNodes, newEdges } = cloneNodesAndEdges(selected, relevantEdges, 40);
    setNodes((nds) => nds.map((n): Node => ({ ...n, selected: false })).concat(newNodes));
    setEdges((eds) => eds.map((e): Edge => ({ ...e, selected: false })).concat(newEdges));
  }, [nodes, edges, setNodes, setEdges]);

  const bringToFront = useCallback(() => {
    setNodes((nds) => {
      if (!nds.some((n) => n.selected)) return nds;
      const maxZ = Math.max(0, ...nds.map((n) => n.zIndex ?? 0));
      return nds.map((n) => (n.selected ? { ...n, zIndex: maxZ + 1 } : n));
    });
  }, [setNodes]);

  const sendToBack = useCallback(() => {
    setNodes((nds) => {
      if (!nds.some((n) => n.selected)) return nds;
      const minZ = Math.min(0, ...nds.map((n) => n.zIndex ?? 0));
      return nds.map((n) => (n.selected ? { ...n, zIndex: minZ - 1 } : n));
    });
  }, [setNodes]);

  type AlignKind = "left" | "centerH" | "right" | "top" | "centerV" | "bottom";

  const alignSelection = useCallback(
    (kind: AlignKind) => {
      setNodes((nds) => {
        const selected = nds.filter((n) => n.selected);
        if (selected.length < 2) return nds;
        const rects = new Map(selected.map((n) => [n.id, getNodeRect(n)]));
        const minX = Math.min(...selected.map((n) => rects.get(n.id)!.x));
        const maxX = Math.max(...selected.map((n) => rects.get(n.id)!.x + rects.get(n.id)!.width));
        const minY = Math.min(...selected.map((n) => rects.get(n.id)!.y));
        const maxY = Math.max(...selected.map((n) => rects.get(n.id)!.y + rects.get(n.id)!.height));
        return nds.map((n) => {
          if (!n.selected) return n;
          const r = rects.get(n.id)!;
          if (kind === "left") return { ...n, position: { ...n.position, x: minX } };
          if (kind === "right") return { ...n, position: { ...n.position, x: maxX - r.width } };
          if (kind === "centerH") return { ...n, position: { ...n.position, x: (minX + maxX) / 2 - r.width / 2 } };
          if (kind === "top") return { ...n, position: { ...n.position, y: minY } };
          if (kind === "bottom") return { ...n, position: { ...n.position, y: maxY - r.height } };
          return { ...n, position: { ...n.position, y: (minY + maxY) / 2 - r.height / 2 } };
        });
      });
    },
    [setNodes]
  );

  const distributeSelection = useCallback(
    (axis: "horizontal" | "vertical") => {
      setNodes((nds) => {
        const selected = nds.filter((n) => n.selected);
        if (selected.length < 3) return nds;
        const rects = new Map(selected.map((n) => [n.id, getNodeRect(n)]));
        const center = (n: Node) => {
          const r = rects.get(n.id)!;
          return axis === "horizontal" ? r.x + r.width / 2 : r.y + r.height / 2;
        };
        const sorted = [...selected].sort((a, b) => center(a) - center(b));
        const startCenter = center(sorted[0]);
        const endCenter = center(sorted[sorted.length - 1]);
        const step = (endCenter - startCenter) / (sorted.length - 1);
        const targetCenters = new Map(sorted.map((n, i) => [n.id, startCenter + step * i]));
        return nds.map((n) => {
          if (!n.selected) return n;
          const r = rects.get(n.id)!;
          const target = targetCenters.get(n.id)!;
          return axis === "horizontal"
            ? { ...n, position: { ...n.position, x: target - r.width / 2 } }
            : { ...n, position: { ...n.position, y: target - r.height / 2 } };
        });
      });
    },
    [setNodes]
  );

  // Groups 2+ (unparented, non-group) selected nodes into a new invisible
  // Group container, auto-sized to fit them. Unlike Frame, deleting a Group
  // deletes its members too (React Flow's own cascade-delete, unmodified).
  const groupSelection = useCallback(() => {
    setNodes((nds) => {
      const selected = nds.filter((n) => n.selected && !n.parentId && n.type !== "group");
      if (selected.length < 2) return nds;
      const rects = selected.map(getNodeRect);
      const minX = Math.min(...rects.map((r) => r.x));
      const minY = Math.min(...rects.map((r) => r.y));
      const maxX = Math.max(...rects.map((r) => r.x + r.width));
      const maxY = Math.max(...rects.map((r) => r.y + r.height));
      const PAD = 20;
      const groupId = uuid();
      const selectedIds = new Set(selected.map((n) => n.id));
      const updated = nds.map((n) => {
        if (!selectedIds.has(n.id)) return n;
        return {
          ...n,
          parentId: groupId,
          position: { x: n.position.x - (minX - PAD), y: n.position.y - (minY - PAD) },
          selected: false,
        };
      });
      const group: Node = {
        id: groupId,
        type: "group",
        position: { x: minX - PAD, y: minY - PAD },
        style: { width: maxX - minX + PAD * 2, height: maxY - minY + PAD * 2 },
        zIndex: -1,
        data: {},
        selected: true,
      };
      return reorderByParent([...updated, group]);
    });
  }, [setNodes]);

  const ungroupSelection = useCallback(() => {
    setNodes((nds) => {
      const selectedGroups = nds.filter((n) => n.selected && n.type === "group");
      if (selectedGroups.length === 0) return nds;
      const groupIds = new Set(selectedGroups.map((g) => g.id));
      return nds
        .filter((n) => !groupIds.has(n.id))
        .map((n) => {
          if (n.parentId && groupIds.has(n.parentId)) {
            const group = nds.find((g) => g.id === n.parentId)!;
            return {
              ...n,
              parentId: undefined,
              position: { x: group.position.x + n.position.x, y: group.position.y + n.position.y },
              selected: true,
            };
          }
          return n;
        });
    });
  }, [setNodes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (presenting) {
        if (e.key === "Escape") {
          setPresenting(false);
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          const i = pages.findIndex((p) => p.id === activePageId);
          if (i < pages.length - 1) switchToPage(pages[i + 1].id);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          const i = pages.findIndex((p) => p.id === activePageId);
          if (i > 0) switchToPage(pages[i - 1].id);
        }
        return;
      }
      if (e.key === "Escape") {
        if (shortcutsOpen) setShortcutsOpen(false);
        if (findOpen) setFindOpen(false);
        if (pencilActive) onExitPencilMode();
        if (selectModeActive) onExitSelectMode();
        if (textToolActive) onExitTextTool();
        if (handModeActive) onExitHandMode();
        // With no tool to leave first, Esc leaves focus mode.
        if (focusMode && !pencilActive && !selectModeActive && !textToolActive && !handModeActive) setFocusMode(false);
        setContextMenu(null);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "f" && isBoardRef.current) {
        e.preventDefault();
        setFocusMode((f) => !f);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        onToggleHandMode();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        onToggleTextTool();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((open) => !open);
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        bringToFront();
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        sendToBack();
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setNodes((nds) =>
          nds.map((n) =>
            n.selected && !(n.data as { locked?: boolean }).locked
              ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
              : n
          )
        );
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (key === "z") {
        e.preventDefault();
        undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      } else if (key === "c") {
        e.preventDefault();
        copySelection();
      } else if (key === "v") {
        e.preventDefault();
        pasteClipboard();
      } else if (key === "d") {
        e.preventDefault();
        duplicateSelection();
      } else if (key === "a") {
        e.preventDefault();
        setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
        setEdges((eds) => eds.map((e2) => ({ ...e2, selected: true })));
      } else if (key === "s") {
        e.preventDefault();
        saveToFileRef.current();
      } else if (key === "=" || key === "+") {
        e.preventDefault();
        zoomTo(stepZoom(getZoom(), 1), { duration: 150 });
      } else if (key === "-") {
        e.preventDefault();
        zoomTo(stepZoom(getZoom(), -1), { duration: 150 });
      } else if (key === "g" && e.shiftKey) {
        e.preventDefault();
        ungroupSelection();
      } else if (key === "g") {
        e.preventDefault();
        groupSelection();
      } else if (key === "f") {
        e.preventDefault();
        setFindOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    undo,
    redo,
    groupSelection,
    ungroupSelection,
    copySelection,
    pasteClipboard,
    duplicateSelection,
    bringToFront,
    sendToBack,
    setNodes,
    setEdges,
    zoomTo,
    getZoom,
    shortcutsOpen,
    findOpen,
    presenting,
    pages,
    activePageId,
    switchToPage,
    pencilActive,
    onExitPencilMode,
    selectModeActive,
    onExitSelectMode,
    textToolActive,
    onExitTextTool,
    onToggleTextTool,
    handModeActive,
    onExitHandMode,
    onToggleHandMode,
    focusMode,
  ]);


  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  // Dragging a selected edge's start or end dot onto a different shape's
  // handle re-attaches that end there; waypoints/label/style are kept.
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
    },
    [setEdges]
  );

  // Reparent a node into a frame it's fully dropped inside, or unparent it
  // when dragged out of its current frame's bounds. Also applies grid-snap.
  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, dragged: Node) => {
      lastInteractedRef.current = { type: "node", id: dragged.id };
      setGuides({ vertical: [], horizontal: [] });
      if (isContainerType(dragged.type)) {
        if (!gridSnapEnabled) return;
        setNodes((nds) => nds.map((n) => (n.id === dragged.id ? { ...n, position: snapPosition(n.position) } : n)));
        return;
      }
      setNodes((nds) => {
        const found = nds.find((n) => n.id === dragged.id);
        if (!found) return nds;
        let current = gridSnapEnabled ? { ...found, position: snapPosition(found.position) } : found;
        // On a ruled White Board, text lines up with the rules.
        if (backgroundRef.current === "lines" && found.type === "text") {
          const h = typeof found.style?.height === "number" ? found.style.height : TEXT_BOX_HEIGHT;
          const y = Math.round((current.position.y + h) / RULE_GAP) * RULE_GAP - h;
          current = { ...current, position: { ...current.position, y } };
        }

        if (current.parentId) {
          const parent = nds.find((n) => n.id === current.parentId);
          if (parent) {
            const rect = getNodeRect(current);
            const absRect = { x: parent.position.x + rect.x, y: parent.position.y + rect.y, width: rect.width, height: rect.height };
            if (isFullyInside(absRect, getNodeRect(parent))) {
              const updated = current === found ? nds : nds.map((n) => (n.id === dragged.id ? current : n));
              return growContainerToFit(updated, parent.id);
            }
            return reorderByParent(
              nds.map((n) =>
                n.id === dragged.id
                  ? { ...n, parentId: undefined, position: { x: absRect.x, y: absRect.y } }
                  : n
              )
            );
          }
        }

        const nodeRect = getNodeRect(current);
        const targetFrame = nds.find(
          (n) => isContainerType(n.type) && n.id !== current.id && isFullyInside(nodeRect, getNodeRect(n))
        );
        if (targetFrame) {
          const reparented = reorderByParent(
            nds.map((n) =>
              n.id === dragged.id
                ? {
                    ...n,
                    parentId: targetFrame.id,
                    position: { x: nodeRect.x - targetFrame.position.x, y: nodeRect.y - targetFrame.position.y },
                  }
                : n
            )
          );
          return growContainerToFit(reparented, targetFrame.id);
        }
        return current === found ? nds : nds.map((n) => (n.id === dragged.id ? current : n));
      });
    },
    [setNodes, gridSnapEnabled]
  );

  // Shows temporary alignment guides while dragging a top-level node, when
  // its edges/center line up with another top-level node's.
  const onNodeDrag = useCallback(
    (_event: MouseEvent | TouchEvent, dragged: Node) => {
      if (dragged.parentId || isContainerType(dragged.type)) {
        if (guides.vertical.length || guides.horizontal.length) setGuides({ vertical: [], horizontal: [] });
        return;
      }
      const rect = getNodeRect(dragged);
      const draggedX = [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
      const draggedY = [rect.y, rect.y + rect.height / 2, rect.y + rect.height];
      const vSet = new Set<number>();
      const hSet = new Set<number>();
      for (const other of nodes) {
        if (other.id === dragged.id || other.parentId) continue;
        const otherRect = getNodeRect(other);
        const otherX = [otherRect.x, otherRect.x + otherRect.width / 2, otherRect.x + otherRect.width];
        const otherY = [otherRect.y, otherRect.y + otherRect.height / 2, otherRect.y + otherRect.height];
        for (const dx of draggedX) {
          for (const ox of otherX) {
            if (Math.abs(dx - ox) < GUIDE_THRESHOLD) vSet.add(ox);
          }
        }
        for (const dy of draggedY) {
          for (const oy of otherY) {
            if (Math.abs(dy - oy) < GUIDE_THRESHOLD) hSet.add(oy);
          }
        }
      }
      setGuides({ vertical: [...vSet], horizontal: [...hSet] });
    },
    [nodes, guides.vertical.length, guides.horizontal.length]
  );

  // Deleting a Frame or Swimlane unparents its children instead of removing
  // them (a Group is the opposite - deleting it deletes its members too, via
  // React Flow's default cascade, so it's deliberately excluded here).
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removedFrameIds = new Set(
        changes
          .filter((c) => c.type === "remove")
          .map((c) => c.id)
          .filter((id) => {
            const t = nodes.find((n) => n.id === id)?.type;
            return t === "frame" || t === "swimlane";
          })
      );
      if (removedFrameIds.size === 0) {
        onNodesChange(changes);
        return;
      }
      // React Flow's own delete logic (getElementsToRemove) auto-cascades a
      // parent removal to its children, so the children of a removed frame
      // already have their own "remove" entries in `changes` by this point.
      // Drop those so they survive - only unparenting them, not deleting them.
      const childIdsToSpare = new Set(
        nodes.filter((n) => n.parentId && removedFrameIds.has(n.parentId)).map((n) => n.id)
      );
      const filteredChanges = changes.filter((c) => !(c.type === "remove" && childIdsToSpare.has(c.id)));
      setNodes((nds) => {
        const unparented = nds.map((n) => {
          if (n.parentId && removedFrameIds.has(n.parentId)) {
            const parent = nds.find((p) => p.id === n.parentId);
            if (parent) {
              return {
                ...n,
                parentId: undefined,
                position: { x: parent.position.x + n.position.x, y: parent.position.y + n.position.y },
              };
            }
          }
          return n;
        });
        return applyNodeChanges(filteredChanges, unparented);
      });
    },
    [nodes, onNodesChange, setNodes]
  );

  const applyStylePatch = useCallback(
    (patch: Record<string, unknown>) => {
      setNodes((nds) => nds.map((n) => (n.selected ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [setNodes]
  );

  // "Smart" is the one connector style that needs geometry from the whole
  // page (every other node as a routing obstacle), computed asynchronously
  // via MSAGL, rather than a pure function of the two endpoints like the
  // other styles - so it's handled as its own branch, applied once the
  // route resolves. Leaving a "smart" edge's old routed waypoints in place
  // after switching to a different connector style would make it render as
  // a stale hand-placed-waypoint polyline instead of that style's own path,
  // so switching away from "smart" clears them.
  const applyEdgeStylePatch = useCallback(
    (patch: {
      lineStyle?: LineStyle;
      arrowHead?: ArrowHead;
      startArrowHead?: ArrowHead;
      connectorStyle?: ConnectorStyle;
      label?: string;
    }) => {
      if (patch.connectorStyle === "smart") {
        const nodeRects = new Map(nodes.map((n) => [n.id, getNodeRect(n)]));
        const targets = edges.filter((e) => e.selected);
        Promise.all(
          targets.map((e) => computeSmartRoute(e.source, e.target, nodeRects).then((waypoints) => [e.id, waypoints] as const))
        ).then((routed) => {
          const routes = new Map(routed);
          setEdges((eds) =>
            eds.map((e) => {
              if (!e.selected) return e;
              const { data, strokeDasharray, markerEnd, markerStart } = edgeStyleFromPatch(
                (e.data as Record<string, unknown>) ?? {},
                patch
              );
              return {
                ...e,
                data: { ...data, waypoints: routes.get(e.id) ?? [] },
                style: { ...e.style, strokeDasharray },
                markerEnd,
                markerStart,
              };
            })
          );
        });
        return;
      }
      setEdges((eds) =>
        eds.map((e) => {
          if (!e.selected) return e;
          const prevConnectorStyle = (e.data as { connectorStyle?: ConnectorStyle } | undefined)?.connectorStyle;
          const { data, strokeDasharray, markerEnd, markerStart } = edgeStyleFromPatch(
            (e.data as Record<string, unknown>) ?? {},
            patch
          );
          const clearSmartWaypoints = patch.connectorStyle !== undefined && prevConnectorStyle === "smart";
          return {
            ...e,
            data: clearSmartWaypoints ? { ...data, waypoints: [] } : data,
            style: { ...e.style, strokeDasharray },
            markerEnd,
            markerStart,
            label: patch.label !== undefined ? patch.label : e.label,
          };
        })
      );
    },
    [nodes, edges, setEdges]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (!node.selected) {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
      }
      setContextMenu({ x: event.clientX, y: event.clientY, type: "node", id: node.id });
    },
    [setNodes, setEdges]
  );

  // React Flow renders an overlay over a multi-node selection's bounding box
  // (for dragging the group), which sits above the individual nodes and
  // swallows right-clicks meant for them - so opening the node menu for a
  // multi-selection needs this separate handler for the overlay itself.
  const onSelectionContextMenu = useCallback((event: React.MouseEvent, selectedNodes: Node[]) => {
    event.preventDefault();
    if (selectedNodes.length === 0) return;
    setContextMenu({ x: event.clientX, y: event.clientY, type: "node", id: selectedNodes[0].id });
  }, []);

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      if (!edge.selected) {
        setEdges((eds) => eds.map((e) => ({ ...e, selected: e.id === edge.id })));
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      }
      setContextMenu({ x: event.clientX, y: event.clientY, type: "edge", id: edge.id });
    },
    [setNodes, setEdges]
  );

  const copyStyleFrom = useCallback(
    (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const { color, strokeColor, fontSize, bold, italic, underline, fontFamily } = target.data as Record<string, unknown>;
      styleClipboardRef.current = { color, strokeColor, fontSize, bold, italic, underline, fontFamily };
    },
    [nodes]
  );

  const pasteStyleToSelection = useCallback(() => {
    if (!styleClipboardRef.current) return;
    const patch = styleClipboardRef.current;
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, [setNodes]);

  const deleteSelection = useCallback(() => {
    deleteElements({
      nodes: nodes.filter((n) => n.selected).map((n) => ({ id: n.id })),
      edges: edges.filter((e) => e.selected).map((e) => ({ id: e.id })),
    });
  }, [nodes, edges, deleteElements]);

  const duplicateEdge = useCallback(
    (edgeId: string) => {
      const source = edges.find((e) => e.id === edgeId);
      if (!source) return;
      setEdges((eds) => eds.concat({ ...source, id: uuid(), selected: false }));
    },
    [edges, setEdges]
  );

  const toggleLock = useCallback(
    (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const nextLocked = !(target.data as { locked?: boolean }).locked;
      setNodes((nds) =>
        nds.map((n) =>
          n.selected ? { ...n, draggable: !nextLocked, data: { ...n.data, locked: nextLocked } } : n
        )
      );
    },
    [nodes, setNodes]
  );

  const toggleNote = useCallback(
    (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return;
      if ((target.data as { comment?: string }).comment === undefined) {
        setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, comment: "" } } : n)));
      }
      setNoteEditingId(nodeId);
    },
    [nodes, setNodes]
  );

  const removeLink = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const { link: _removed, ...rest } = n.data as Record<string, unknown>;
          return { ...n, data: rest };
        })
      );
    },
    [setNodes]
  );

  const navigateLink = useCallback(
    (node: Node) => {
      const link = (node.data as { link?: { type: "url" | "page"; value: string } }).link;
      if (!link) return;
      if (link.type === "url") {
        window.open(link.value, "_blank", "noopener,noreferrer");
      } else {
        switchToPage(link.value);
      }
    },
    [switchToPage]
  );

  const contextMenuActions: ContextMenuAction[] = (() => {
    if (!contextMenu) return [];
    if (contextMenu.type === "node") {
      const target = nodes.find((n) => n.id === contextMenu.id);
      const locked = !!(target?.data as { locked?: boolean } | undefined)?.locked;
      const hasNote = (target?.data as { comment?: string } | undefined)?.comment !== undefined;
      const hasLink = (target?.data as { link?: unknown } | undefined)?.link !== undefined;
      const selectedCount = nodes.filter((n) => n.selected).length;
      const hasGroupSelected = nodes.some((n) => n.selected && n.type === "group");
      const actions: ContextMenuAction[] = [
        { label: "Duplicate", onClick: duplicateSelection },
        { label: "Delete", onClick: deleteSelection },
        { label: "Bring to Front", onClick: bringToFront },
        { label: "Send to Back", onClick: sendToBack },
        { label: locked ? "Unlock" : "Lock", onClick: () => toggleLock(contextMenu.id) },
        { label: hasNote ? "Edit Note" : "Add Note", onClick: () => toggleNote(contextMenu.id) },
        { label: hasLink ? "Edit Link" : "Add Link", onClick: () => setLinkEditingId(contextMenu.id) },
        { label: "Edit Data", onClick: () => setDataEditingId(contextMenu.id) },
        { label: "Copy Style", onClick: () => copyStyleFrom(contextMenu.id) },
        { label: "Paste Style", onClick: pasteStyleToSelection, disabled: !styleClipboardRef.current },
      ];
      if (hasGroupSelected) {
        actions.push({ label: "Ungroup", onClick: ungroupSelection });
      } else {
        actions.push({ label: "Group", onClick: groupSelection, disabled: selectedCount < 2 });
      }
      return actions;
    }
    return [
      { label: "Duplicate", onClick: () => duplicateEdge(contextMenu.id) },
      { label: "Delete", onClick: deleteSelection },
    ];
  })();

  // Renders the whole diagram (not just what's on screen) to a PNG or SVG data
  // URL. html-to-image only clones the .react-flow__viewport subtree, which
  // loses three things the live page gets from outside it, so each is put
  // back for the duration of the capture:
  //  - edge stroke colors come from CSS variables defined on the .react-flow
  //    root, so edges were exported with no line at all - the resolved values
  //    are written onto the edge and arrowhead elements;
  //  - the custom ER arrowhead markers live in a separate hidden <svg> - a
  //    copy of those definitions is added inside the viewport;
  //  - selection/connection UI (handles, resize dots, edge end dots) is left out
  //    and a selected edge/node is drawn as if unselected.
  const renderDiagram = useCallback(
    async (format: "png" | "svg"): Promise<{ dataUrl: string; width: number; height: number } | null> => {
      const currentNodes = getNodes();
      if (currentNodes.length === 0) return null;
      const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
      if (!el) return null;
      const PAD = 50;
      const bounds = getNodesBounds(currentNodes);
      const width = Math.max(Math.ceil(bounds.width) + PAD * 2, 200);
      const height = Math.max(Math.ceil(bounds.height) + PAD * 2, 200);

      const undo: Array<() => void> = [];
      el.querySelectorAll(".selected").forEach((n) => {
        n.classList.remove("selected");
        undo.push(() => n.classList.add("selected"));
      });
      el.querySelectorAll<SVGElement>(".react-flow__edge-path, .react-flow__arrowhead polyline, .react-flow__arrowhead path").forEach(
        (n) => {
          const cs = getComputedStyle(n);
          const before = n.getAttribute("style");
          for (const prop of ["stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "fill"]) {
            n.style.setProperty(prop, cs.getPropertyValue(prop));
          }
          undo.push(() => (before === null ? n.removeAttribute("style") : n.setAttribute("style", before)));
        }
      );
      const defs = document.querySelector("svg[data-marker-defs]");
      if (defs) {
        const copy = defs.cloneNode(true) as SVGElement;
        el.appendChild(copy);
        undo.push(() => copy.remove());
      }

      // Selection / connection UI. html-to-image copies SVG elements wholesale
      // (its filter only sees HTML), so these are taken out of the live DOM for
      // the capture and put back in the same spot afterwards.
      el.querySelectorAll(
        [
          ".react-flow__handle",
          ".react-flow__resize-control",
          ".react-flow__nodesselection",
          ".react-flow__edgeupdater",
          ".react-flow__edge-interaction",
          ".edge-end-dot",
          ".edge-midpoint",
          ".edge-waypoint",
        ].join(",")
      ).forEach((n) => {
        const parent = n.parentNode;
        const next = n.nextSibling;
        if (!parent) return;
        parent.removeChild(n);
        undo.push(() => parent.insertBefore(n, next));
      });
      try {
        const options = {
          backgroundColor: darkMode ? "#1a1a22" : "#ffffff",
          width,
          height,
          pixelRatio: 2,
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${PAD - bounds.x}px, ${PAD - bounds.y}px) scale(1)`,
          },
        };
        const dataUrl = format === "png" ? await toPng(el, options) : await toSvg(el, options);
        return { dataUrl, width, height };
      } finally {
        undo.reverse().forEach((fn) => fn());
      }
    },
    [getNodes, darkMode]
  );

  const exportImage = useCallback(
    async (format: "png" | "svg") => {
      const result = await renderDiagram(format);
      if (!result) return;
      const a = document.createElement("a");
      a.download = `${name || "diagram"}.${format}`;
      a.href = result.dataUrl;
      a.click();
    },
    [renderDiagram, name]
  );

  const exportPDF = useCallback(async () => {
    const result = await renderDiagram("png");
    if (!result) return;
    const { dataUrl, width, height } = result;
    const pdf = new jsPDF({
      orientation: width >= height ? "landscape" : "portrait",
      unit: "px",
      format: [width, height],
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
    pdf.save(`${name || "diagram"}.pdf`);
  }, [renderDiagram, name]);

  // Saves the diagram (name + every page's nodes/edges/viewport) as a local
  // JSON file, so it can be reopened later via "Open from file" - a copy the
  // user holds outside the app's own browser storage. When this diagram was
  // opened from a local file (fileHandle set), writes back to that same file
  // silently instead of prompting a new save dialog each time; browsers
  // without the File System Access API fall back to the classic download.
  const exportToFile = useCallback(async () => {
    const payload = { name, data: { pages: buildPagesData(), customShapes, background: backgroundRef.current, kind: kindRef.current } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    try {
      const handle = await fileSave(
        blob,
        { fileName: `${name || "diagram"}.json`, extensions: [".json"] },
        fileHandle ?? null
      );
      onFileHandleChange(handle ?? undefined);
      // Without the File System Access API (phones, Firefox, Safari) "save" is a
      // download, and the browser decides where it goes: say so.
      if (!handle) showToast(`Downloaded ${name || "diagram"}.json - find it in your Downloads folder or the Files app.`);
      api
        .markSavedToFile(diagramId, fingerprint(payload.data))
        .then(() => onSaved())
        .catch(() => {});
    } catch {
      // User cancelled the save dialog - nothing to do.
    }
  }, [name, diagramId, buildPagesData, customShapes, fileHandle, onFileHandleChange, onSaved, showToast]);
  saveToFileRef.current = exportToFile;

  // Where a newly added shape goes: just right of the last shape (or beside
  // the last arrow) the user touched, nudged down past anything already
  // there; with nothing touched yet, the middle of the visible canvas.
  const lastInteractedRef = useRef<{ type: "node" | "edge"; id: string } | null>(null);

  // Where a new node goes: next to what you last touched or, failing that, the
  // middle of what you are looking at - but always inside the visible canvas, and
  // nudged off other shapes only within it. (It used to push a shape down past
  // every overlapping node, and a freehand stroke's big box counted, so on a
  // drawn-on White Board new shapes ended up far outside the view.)
  const placeNewNode = (width: number, height: number): { x: number; y: number } => {
    const GAP = 40;
    const nds = getNodes();
    const absRect = (n: Node) => {
      const r = getNodeRect(n);
      const parent = n.parentId ? nds.find((p) => p.id === n.parentId) : undefined;
      return parent ? { ...r, x: r.x + parent.position.x, y: r.y + parent.position.y } : r;
    };
    // The visible canvas in flow coordinates.
    const el = document.querySelector(".canvas-flow");
    const box = el?.getBoundingClientRect();
    const tl = screenToFlowPosition({ x: box ? box.x : 0, y: box ? box.y : 0 });
    const br = screenToFlowPosition({
      x: box ? box.x + box.width : window.innerWidth,
      y: box ? box.y + box.height : window.innerHeight,
    });
    const MARGIN = 24;
    const view = { x: tl.x + MARGIN, y: tl.y + MARGIN, w: Math.max(br.x - tl.x - MARGIN * 2, width), h: Math.max(br.y - tl.y - MARGIN * 2, height) };
    const inView = (p: { x: number; y: number }) =>
      p.x >= view.x && p.y >= view.y && p.x + width <= view.x + view.w && p.y + height <= view.y + view.h;
    const center = { x: view.x + (view.w - width) / 2, y: view.y + (view.h - height) / 2 };

    const last = lastInteractedRef.current;
    let pos: { x: number; y: number } | null = null;
    if (last?.type === "node") {
      const n = nds.find((x) => x.id === last.id);
      if (n) {
        const r = absRect(n);
        pos = { x: r.x + r.width + GAP, y: r.y + (r.height - height) / 2 };
      }
    } else if (last?.type === "edge") {
      const e = edges.find((x) => x.id === last.id);
      const src = e && nds.find((x) => x.id === e.source);
      const tgt = e && nds.find((x) => x.id === e.target);
      if (src && tgt) {
        const a = absRect(src);
        const b = absRect(tgt);
        pos = {
          x: (a.x + a.width / 2 + b.x + b.width / 2) / 2 - width / 2,
          y: (a.y + a.height / 2 + b.y + b.height / 2) / 2 + GAP,
        };
      }
    }
    // Only follow the last-touched node if the result is actually on screen.
    if (!pos || !inView(pos)) pos = center;

    // Strokes are boxes that are mostly empty: never steer around them.
    const others = nds.filter((n) => !isContainerType(n.type) && n.type !== "freehand").map(absRect);
    const overlaps = (p: { x: number; y: number }) =>
      others.some((o) => p.x < o.x + o.width + 8 && p.x + width + 8 > o.x && p.y < o.y + o.height + 8 && p.y + height + 8 > o.y);
    if (overlaps(pos)) {
      // Look for a free spot around the start, in widening rings, inside the view.
      const stepX = width + GAP / 2;
      const stepY = height + GAP / 2;
      let found: { x: number; y: number } | null = null;
      for (let ring = 1; ring <= 6 && !found; ring++) {
        for (let dy = -ring; dy <= ring && !found; dy++) {
          for (let dx = -ring; dx <= ring && !found; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            const cand = { x: pos.x + dx * stepX, y: pos.y + dy * stepY };
            if (inView(cand) && !overlaps(cand)) found = cand;
          }
        }
      }
      if (found) pos = found; // otherwise: stack on top, but in view
    }
    return pos;
  };

  const addNode = (kind: WidgetKind) => {
    const position = { x: 0, y: 0 };
    let node: Node;
    if (kind === "sticky") {
      node = { id: uuid(), type: "sticky", position, data: { text: "" }, style: { width: 180, height: 140 } };
    } else if (kind === "text") {
      node = { id: uuid(), type: "text", position, data: { text: "", autoWidth: true }, style: { width: 160, height: 40 } };
    } else if (kind === "frame") {
      node = {
        id: uuid(),
        type: "frame",
        position,
        data: { label: "Frame" },
        style: { width: 320, height: 220 },
        zIndex: -1,
      };
    } else if (kind === "swimlane") {
      node = {
        id: uuid(),
        type: "swimlane",
        position,
        data: {
          orientation: "vertical",
          lanes: [
            { id: uuid(), label: "Lane 1", size: 1 },
            { id: uuid(), label: "Lane 2", size: 1 },
          ],
        },
        style: { width: 500, height: 300 },
        zIndex: -1,
      };
    } else if (kind === "table") {
      node = {
        id: uuid(),
        type: "table",
        position,
        data: { rows: [["", ""], ["", ""]] },
        style: { width: 240, height: 140 },
      };
    } else if (kind === "uml-class") {
      node = {
        id: uuid(),
        type: "uml-class",
        position,
        data: { className: "ClassName", attributes: "+ attribute: Type", methods: "+ method(): ReturnType" },
        style: { width: 200, height: 160 },
      };
    } else {
      // Actor's icon is naturally portrait (a narrow standing figure), unlike
      // every other shape's landscape default box - keeping the generic
      // box here would squash it noticeably now that its SVG viewBox is
      // cropped to stretch edge-to-edge (see SVG_SHAPES in ShapeNode.tsx).
      const base = kind === "actor" ? DEFAULT_ACTOR_SIZE : DEFAULT_SHAPE_SIZE;
      // Zoomed out, a default-sized shape would land tiny on screen: size it up
      // (to at most 2.5x) so it looks about the same as at 100%.
      const scale = Math.min(2.5, Math.max(1, 1 / getViewport().zoom));
      const size = { width: Math.round(base.width * scale), height: Math.round(base.height * scale) };
      node = {
        id: uuid(),
        type: "shape",
        position,
        data: { shape: kind, text: "" },
        style: size,
      };
    }
    const w = typeof node.style?.width === "number" ? node.style.width : 120;
    const h = typeof node.style?.height === "number" ? node.style.height : 70;
    node.position = placeNewNode(w, h);
    lastInteractedRef.current = { type: "node", id: node.id };
    setNodes((nds) => nds.concat(node));
  };

  // Typing straight onto the canvas: a new empty text box (opened for typing) at
  // the given screen point. On ruled White Boards the box sits between two lines.
  const createTextAt = (clientX: number, clientY: number) => {
    const p = screenToFlowPosition({ x: clientX, y: clientY });
    const height = TEXT_BOX_HEIGHT;
    let position = { x: p.x, y: p.y - height / 2 };
    if (backgroundRef.current === "lines") position = { x: Math.round(p.x / GRID_SIZE) * GRID_SIZE, y: Math.round(p.y / RULE_GAP) * RULE_GAP - height };
    else if (gridSnapEnabled) position = snapPosition(position);
    const node: Node = {
      id: uuid(),
      type: "text",
      position,
      data: { text: "", autoEdit: true, autoWidth: true },
      style: { width: 200, height },
      // Known size up front, so React Flow shows the box (and it can take focus) at once.
      width: 200,
      height,
      selected: false,
    };
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)).concat(node));
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (pencilActive || presenting) return;
    if (!(e.target as HTMLElement).classList.contains("react-flow__pane")) return;
    createTextAt(e.clientX, e.clientY);
  };

  const uploadCustomShape = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        showToast("Only SVG or PNG (and other image) files can be imported as a custom shape.");
        return;
      }
      try {
        const { url } = await api.uploadImage(file);
        const name = file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "Custom shape";
        setCustomShapes((prev) => [...prev, { id: uuid(), name, url }]);
      } catch {
        showToast("Could not upload that file as a custom shape.");
      }
    },
    [showToast]
  );

  const addCustomShapeNode = useCallback(
    (customShapeId: string) => {
      const shape = customShapesRef.current.find((s) => s.id === customShapeId);
      if (!shape) return;
      const width = 160;
      const height = 120;
      const position = placeNewNode(width, height);
      const node: Node = {
        id: uuid(),
        type: "image",
        position,
        data: { url: shape.url },
        style: { width, height },
      };
      lastInteractedRef.current = { type: "node", id: node.id };
      setNodes((nds) => nds.concat(node));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setNodes, edges]
  );

  useImperativeHandle(ref, () => ({ addNode, uploadCustomShape, addCustomShapeNode, rename: setName }));

  const addImageNode = useCallback(
    async (file: File, screenPos: { x: number; y: number }) => {
      const { url } = await api.uploadImage(file);
      const position = screenToFlowPosition(screenPos);
      const width = 220;
      const height = 160;
      const node: Node = {
        id: uuid(),
        type: "image",
        position: { x: position.x - width / 2, y: position.y - height / 2 },
        data: { url },
        style: { width, height },
      };
      setNodes((nds) => nds.concat(node));
    },
    [screenToFlowPosition, setNodes]
  );

  // Paste an image from the OS clipboard (Ctrl/Cmd+V with an image copied,
  // not to be confused with the app's own node-clipboard paste which is
  // handled separately by the keyboard shortcut effect below).
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          addImageNode(file, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addImageNode]);

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      addImageNode(file, { x: e.clientX, y: e.clientY });
    },
    [addImageNode]
  );

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Freehand "pencil" drawing: while active, dragging on the canvas collects
  // points (in flow coordinates) instead of panning, then turns them into a
  // freehand path node on release. Pencil mode itself stays active across
  // strokes (matches how a real drawing tool behaves - draw several shapes
  // in a row without re-clicking "Pencil" each time); the user turns it off
  // explicitly via the Pencil/"Drawing…" button or Escape.
  //
  // Points accumulate in a ref rather than React state - state would mean
  // copying the whole array on every mousemove (O(n) per point, O(n²) per
  // stroke) just to get a live preview. `previewTick` is a separate, cheap
  // state bump used only to force the preview to re-render; the preview
  // itself reads the current points straight from the ref.
  const drawPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  // Only the setter is used - bumping it forces a re-render so the preview
  // below picks up the ref's latest points; the counter value itself is
  // never read.
  const [, setPreviewTick] = useState(0);

  // Moving around while the Pencil is on, without switching tools:
  //  - mouse wheel / trackpad scroll pans (Ctrl/Cmd + wheel or pinch zooms);
  //  - hold Space and drag, or drag with the middle mouse button, to pan;
  //  - while drawing, pushing the pointer against the canvas edge scrolls that
  //    way so the stroke can carry on past the visible area.
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const finishStrokeRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!pencilActive) {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      return;
    }
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return;
      e.preventDefault();
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      // A toolbar button that still has focus (e.g. Pencil, just clicked)
      // would otherwise be "clicked" by this Space release.
      if (spaceHeldRef.current) e.preventDefault();
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };
    const release = () => {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
    };
  }, [pencilActive]);

  useEffect(() => {
    if (!isDrawing) return;
    const EDGE = 48; // px from the canvas edge where scrolling starts
    const MAX_SPEED = 16; // px per frame, right at the edge
    const track = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };
    const release = () => finishStrokeRef.current();
    window.addEventListener("pointermove", track);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    let raf = 0;
    const tick = () => {
      const rect = document.querySelector(".canvas-flow")?.getBoundingClientRect();
      const p = pointerRef.current;
      if (rect && p) {
        const push = (distFromEdge: number) => 1 - Math.min(Math.max(distFromEdge, 0), EDGE) / EDGE;
        const vx = p.x < rect.left + EDGE ? -push(p.x - rect.left) : p.x > rect.right - EDGE ? push(rect.right - p.x) : 0;
        const vy = p.y < rect.top + EDGE ? -push(p.y - rect.top) : p.y > rect.bottom - EDGE ? push(rect.bottom - p.y) : 0;
        if (vx || vy) {
          const vp = getViewport();
          setViewport({ x: vp.x - vx * MAX_SPEED, y: vp.y - vy * MAX_SPEED, zoom: vp.zoom });
          // The pointer hasn't moved but the page under it has: extend the stroke.
          drawPointsRef.current.push(screenToFlowPosition(p));
          setPreviewTick((t) => t + 1);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [isDrawing, getViewport, setViewport, screenToFlowPosition]);

  // Pointer events (not mouse events) so a finger or pen draws too: a touch drag
  // fires no mouse events. While the pencil is on, the canvas must not pan or
  // scroll under the finger, so the pane's own one-finger pan is stopped.
  const handleCanvasTouchStartCapture = useCallback(
    (e: React.TouchEvent) => {
      if (!pencilActive || spaceHeldRef.current || e.touches.length !== 1) return;
      if (e.target instanceof Element && e.target.closest(NOT_DRAWABLE_SELECTOR)) return;
      e.stopPropagation();
    },
    [pencilActive]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.PointerEvent) => {
      if (!pencilActive || e.button !== 0 || !e.isPrimary || spaceHeldRef.current) return;
      // Floating panels, buttons and form controls sit inside the canvas area
      // too; pressing on them (e.g. the pencil palette) must not start a stroke.
      if (e.target instanceof Element && e.target.closest(NOT_DRAWABLE_SELECTOR)) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // capture is only a convenience (keeps the stroke when the finger leaves the canvas)
      }
      pointerRef.current = { x: e.clientX, y: e.clientY };
      setIsDrawing(true);
      drawPointsRef.current = [screenToFlowPosition({ x: e.clientX, y: e.clientY })];
      setPreviewTick((t) => t + 1);
    },
    [pencilActive, screenToFlowPosition]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pencilActive || !isDrawing) return;
      drawPointsRef.current.push(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      setPreviewTick((t) => t + 1);
    },
    [pencilActive, isDrawing, screenToFlowPosition]
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (!pencilActive || !isDrawing) return;
    setIsDrawing(false);
    const points = drawPointsRef.current;
    drawPointsRef.current = [];
    if (points.length < 2) return;
    const strokeWidth = pencilOptions.size;
    const stroke = computeSmoothedFreehandPath(
      points,
      strokeWidth,
      Math.max(10, strokeWidth),
      pencilOptions.style === "uniform" ? 0 : 0.5
    );
    const node: Node = {
      id: uuid(),
      type: "freehand",
      position: stroke.position,
      data: {
        pathD: stroke.pathD,
        viewBox: `0 0 ${stroke.width} ${stroke.height}`,
        strokeColor: penColor,
        autoColor: pencilOptions.color === AUTO_PEN,
        strokeWidth,
        opacity: pencilOptions.opacity,
        smoothed: true,
      },
      style: { width: stroke.width, height: stroke.height },
    };
    setNodes((nds) => nds.concat(node));
  }, [pencilActive, isDrawing, setNodes, pencilOptions, penColor]);
  finishStrokeRef.current = handleCanvasMouseUp;

  // Raw (unsmoothed) preview of the in-progress stroke, in screen space -
  // reads drawPointsRef directly, so it only reflects the latest points once
  // something (setPreviewTick, above) has actually triggered this
  // re-render. Deliberately not the same getStroke()-based smoothing used
  // for the final node: recomputing that on every mousemove would be
  // needlessly expensive for a preview that's about to be replaced anyway
  // once the stroke ends.
  const previewPathD =
    isDrawing && drawPointsRef.current.length > 1
      ? "M " +
        drawPointsRef.current
          .map((p) => `${p.x * viewport.zoom + viewport.x},${p.y * viewport.zoom + viewport.y}`)
          .join(" L ")
      : null;

  // Find & Replace: searches node text/label and edge labels on the current
  // page. Scoped to the current page only (not all pages) - keeps the
  // navigate/replace flow simple and reliable rather than juggling a
  // cross-page match cursor.
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);

  const getNodeSearchText = (n: Node): string => {
    const d = n.data as Record<string, unknown>;
    return String(d.text ?? d.label ?? "");
  };

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const findMatches: { nodeId?: string; edgeId?: string }[] = (() => {
    if (!findQuery.trim()) return [];
    const q = findQuery.toLowerCase();
    const results: { nodeId?: string; edgeId?: string }[] = [];
    nodes.forEach((n) => {
      if (getNodeSearchText(n).toLowerCase().includes(q)) results.push({ nodeId: n.id });
    });
    edges.forEach((e) => {
      if (typeof e.label === "string" && e.label.toLowerCase().includes(q)) results.push({ edgeId: e.id });
    });
    return results;
  })();
  const currentMatch = findMatches[findIndex] ?? null;

  useEffect(() => {
    setFindIndex(0);
  }, [findQuery]);

  useEffect(() => {
    if (!findOpen || !currentMatch) return;
    if (currentMatch.nodeId) {
      const targetId = currentMatch.nodeId;
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === targetId })));
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
      fitView({ nodes: [{ id: targetId }], duration: 300, maxZoom: 1.5 });
    } else if (currentMatch.edgeId) {
      const targetId = currentMatch.edgeId;
      setEdges((eds) => eds.map((e) => ({ ...e, selected: e.id === targetId })));
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findIndex, findOpen, findQuery]);

  const replaceInNode = useCallback((n: Node, query: string, replacement: string): Node => {
    const d = n.data as Record<string, unknown>;
    const field = d.text !== undefined ? "text" : d.label !== undefined ? "label" : null;
    if (!field) return n;
    const current = String(d[field] ?? "");
    const re = new RegExp(escapeRegExp(query), "gi");
    if (!re.test(current)) return n;
    return { ...n, data: { ...n.data, [field]: current.replace(re, replacement) } };
  }, []);

  const findNext = useCallback(() => {
    setFindIndex((i) => (findMatches.length ? (i + 1) % findMatches.length : 0));
  }, [findMatches.length]);

  const findPrev = useCallback(() => {
    setFindIndex((i) => (findMatches.length ? (i - 1 + findMatches.length) % findMatches.length : 0));
  }, [findMatches.length]);

  const replaceCurrentMatch = useCallback(() => {
    if (!currentMatch || !findQuery.trim()) return;
    if (currentMatch.nodeId) {
      const targetId = currentMatch.nodeId;
      setNodes((nds) => nds.map((n) => (n.id === targetId ? replaceInNode(n, findQuery, replaceQuery) : n)));
    } else if (currentMatch.edgeId) {
      const targetId = currentMatch.edgeId;
      const re = new RegExp(escapeRegExp(findQuery), "gi");
      setEdges((eds) =>
        eds.map((e) => (e.id === targetId && typeof e.label === "string" ? { ...e, label: e.label.replace(re, replaceQuery) } : e))
      );
    }
  }, [currentMatch, findQuery, replaceQuery, replaceInNode, setNodes, setEdges]);

  const replaceAllMatches = useCallback(() => {
    if (!findQuery.trim()) return;
    const re = new RegExp(escapeRegExp(findQuery), "gi");
    setNodes((nds) => nds.map((n) => replaceInNode(n, findQuery, replaceQuery)));
    setEdges((eds) =>
      eds.map((e) => (typeof e.label === "string" && re.test(e.label) ? { ...e, label: e.label.replace(re, replaceQuery) } : e))
    );
  }, [findQuery, replaceQuery, replaceInNode, setNodes, setEdges]);

  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedEdges = edges.filter((e) => e.selected);

  return (
    <div className={`canvas-area ${presenting ? "presenting" : ""} ${focusMode ? "focus" : ""} ${isBoard ? "is-board" : ""} ${showToolsPanel ? "has-tools-panel" : ""}`}>
      <div className="canvas-header">
        <div className="canvas-header-top">
          <a className="brand" href={SITE_URL} target="_blank" rel="noopener noreferrer" title="AdhocDraw website"><Logo /></a>
          <div className="canvas-header-meta toolbar-group group-app" role="group" aria-label="App">
            <button
              onClick={onToggleDarkMode}
              title={darkMode ? "Switch to the light theme" : "Switch to the dark theme"}
              aria-label={darkMode ? "Light mode" : "Dark mode"}
            >
              <Icon name={darkMode ? "sun" : "moon"} />
            </button>
            <button
              onClick={onToggleTheme}
              title={theme === "palette" ? "Switch to the Classic theme" : "Switch to the Palette theme"}
              aria-label={theme === "palette" ? "Theme: Palette" : "Theme: Classic"}
            >
              <Icon name="palette" />
            </button>
            <button className="shortcuts-btn" onClick={() => setShortcutsOpen(true)} title="Show keyboard shortcuts (?)" aria-label="Shortcuts">
              <Icon name="keyboard" />
            </button>
            <button
              onClick={openRepo}
              title="Source code on GitHub (opens in a new tab)"
              aria-label="AdhocDraw on GitHub"
            >
              <Icon name="github" />
            </button>
            <button onClick={onOpenAbout} title="About, privacy and open-source licenses" aria-label="About">
              <Icon name="info" />
              <span className="btn-label">About</span>
            </button>
          </div>
        </div>
        <div className="canvas-header-actions">
          <div className="toolbar-cluster">
            <span className="toolbar-caption caption-file" aria-hidden="true">File</span>
            <div className="toolbar-group group-file" role="group" aria-label="File">
          {leadingActions}
          <button
            className={`save-file-btn ${needsFileSave ? "needs-save" : ""} ${nudgeFileSave ? "nudge" : ""}`}
            onClick={exportToFile}
            aria-label="Save to file"
            title={
              needsFileSave
                ? "Not saved to a file yet - click to save a copy on your computer (Ctrl/Cmd+S)"
                : "Save this diagram to a file on your computer (Ctrl/Cmd+S)"
            }
          >
            <Icon name="save" />
            <span className="btn-label">Save to file</span>
          </button>
          <Flyout label={<><Icon name="export" /><span className="btn-label">Export</span><span className="caret"> ▾</span></>} ariaLabel="Export" panelClassName="export-flyout" title="Export the diagram as an image (PNG, SVG) or a PDF">
            {(close) => (
              <>
                <button type="button" className="flyout-item" onClick={() => { exportImage("png"); close(); }}>
                  <Icon name="image" />
                  Export PNG
                </button>
                <button type="button" className="flyout-item" onClick={() => { exportImage("svg"); close(); }}>
                  <Icon name="vector" />
                  Export SVG
                </button>
                <button type="button" className="flyout-item" onClick={() => { exportPDF(); close(); }}>
                  <Icon name="pdf" />
                  Export PDF
                </button>
              </>
            )}
          </Flyout>
          </div>
          </div>
          <div className="toolbar-cluster">
            <span className="toolbar-caption caption-draw" aria-hidden="true">Draw</span>
            <div className="toolbar-group group-draw" role="group" aria-label="Draw">
          <button
            className={`shapes-toggle ${shapesPanel.open && !shapesPanel.collapsed ? "active" : ""}`}
            aria-label="Shapes"
            aria-pressed={shapesPanel.open && !shapesPanel.collapsed}
            title="Show or hide the shapes panel"
            onClick={() =>
              setShapesPanel((p) => (!p.open || p.collapsed ? { open: true, collapsed: false } : { ...p, open: false }))
            }
          >
            <Icon name="shapes" />
            <span className="btn-label">Shapes</span>
          </button>
          <button
            className={`hand-mode-btn ${handModeActive ? "active" : ""}`}
            aria-label="Hand"
            aria-pressed={handModeActive}
            title="Hand: drag the canvas to move around (H, Esc to exit)"
            onClick={onToggleHandMode}
          >
            <Icon name="hand" />
            <span className="btn-label">Hand</span>
          </button>
          <button
            className={`select-mode-btn ${selectModeActive ? "active" : ""}`}
            aria-label="Select"
            aria-pressed={selectModeActive}
            title="Drag on the canvas to select several shapes at once (Esc to exit)"
            onClick={onToggleSelectMode}
          >
            <Icon name="select" />
            <span className="btn-label">Select</span>
          </button>
          <button
            className={`pencil-btn ${pencilActive ? "active" : ""}`}
            aria-label="Pencil"
            aria-pressed={pencilActive}
            title="Draw freehand on the canvas (Esc to exit)"
            onClick={onTogglePencil}
          >
            <Icon name="pencil" />
            <span className="btn-label">Pencil</span>
          </button>
          <button
            className={`text-tool-btn ${textToolActive ? "active" : ""}`}
            aria-pressed={textToolActive}
            aria-label="Text tool"
            title="Text: click the canvas and type (T). Double-clicking empty canvas does the same. Esc to exit"
            onClick={onToggleTextTool}
          >
            <Icon name="textTool" />
            <span className="btn-label">Text</span>
          </button>
          <label className="grid-snap-toggle" title="Snap shapes to the grid when you drop them">
            <input
              type="checkbox"
              checked={gridSnapEnabled}
              aria-label="Snap to grid"
              onChange={(e) => setGridSnapEnabled(e.target.checked)}
            />
            <Icon name="grid" />
            <span className="btn-label">Snap to grid</span>
          </label>
          </div>
          </div>
          <div className="toolbar-cluster">
            <span className="toolbar-caption caption-view" aria-hidden="true">View</span>
            <div className="toolbar-group group-view" role="group" aria-label="View and present">
          <button
            onClick={() => setHistoryOpen(true)}
            title="Version history: save and restore earlier versions"
            aria-label="History"
          >
            <Icon name="history" />
            <span className="btn-label">History</span>
          </button>
          <button
            onClick={() => setFindOpen((open) => !open)}
            title="Find and replace text (Ctrl/Cmd+F)"
            aria-label="Find"
          >
            <Icon name="search" />
            <span className="btn-label">Find</span>
          </button>
          {isBoard && (
            <button
              className={`focus-mode-btn ${focusMode ? "active" : ""}`}
              aria-pressed={focusMode}
              aria-label="Focus mode"
              title="Focus mode: edit this board full screen (F, Esc to exit)"
              onClick={() => setFocusMode((f) => !f)}
            >
              <Icon name="focusEdit" />
              <span className="btn-label">Focus</span>
            </button>
          )}
          <button
            className="present-btn"
            title="Present: show the diagram full screen (Esc to exit)"
            aria-label="Present"
            onClick={startPresentation}
          >
            <Icon name="present" />
            <span className="btn-label">Present</span>
          </button>
          </div>
          </div>
        </div>
      </div>
      {diagramTabs}
      <div
        className={`canvas-flow ${pencilActive ? "canvas-flow-drawing" : ""} ${selectModeActive ? "canvas-flow-selecting" : ""} ${textToolActive ? "canvas-flow-texting" : ""} ${handModeActive ? "canvas-flow-hand" : ""} ${pencilActive && spaceHeld ? "canvas-flow-panning" : ""}`}
        onDrop={handleCanvasDrop}
        onDragOver={handleCanvasDragOver}
        onPointerDown={handleCanvasMouseDown}
        onPointerMove={handleCanvasMouseMove}
        onPointerUp={handleCanvasMouseUp}
        onPointerCancel={handleCanvasMouseUp}
        onTouchStartCapture={handleCanvasTouchStartCapture}
        onDoubleClick={handleCanvasDoubleClick}
      >
        <svg width="0" height="0" style={{ position: "absolute" }} data-marker-defs>
          <defs>
            <marker id="adhocdraw-circle-marker" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto" markerUnits="userSpaceOnUse">
              <circle cx="6" cy="6" r="4" className="marker-ink-fill" />
            </marker>
            <marker id="adhocdraw-crow-one" markerWidth="16" markerHeight="16" refX="14" refY="8" orient="auto" markerUnits="userSpaceOnUse">
              <line x1="10" y1="2" x2="10" y2="14" className="marker-ink-stroke" strokeWidth="2" />
            </marker>
            <marker id="adhocdraw-crow-many" markerWidth="16" markerHeight="16" refX="14" refY="8" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M14,8 L2,2 M14,8 L2,8 M14,8 L2,14" className="marker-ink-stroke" strokeWidth="2" fill="none" />
            </marker>
            <marker id="adhocdraw-crow-zero-one" markerWidth="22" markerHeight="16" refX="20" refY="8" orient="auto" markerUnits="userSpaceOnUse">
              <circle cx="4" cy="8" r="3" className="marker-ink-hollow" strokeWidth="1.5" />
              <line x1="14" y1="2" x2="14" y2="14" className="marker-ink-stroke" strokeWidth="2" />
            </marker>
            <marker id="adhocdraw-crow-zero-many" markerWidth="22" markerHeight="16" refX="20" refY="8" orient="auto" markerUnits="userSpaceOnUse">
              <circle cx="4" cy="8" r="3" className="marker-ink-hollow" strokeWidth="1.5" />
              <path d="M20,8 L10,2 M20,8 L10,8 M20,8 L10,14" className="marker-ink-stroke" strokeWidth="2" fill="none" />
            </marker>
          </defs>
        </svg>
        <NotebookLinesContext.Provider value={background === "lines"}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          reconnectRadius={12}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_e, n) => {
            lastInteractedRef.current = { type: "node", id: n.id };
          }}
          onEdgeClick={(_e, ed) => {
            lastInteractedRef.current = { type: "edge", id: ed.id };
          }}
          onNodeContextMenu={onNodeContextMenu}
          onSelectionContextMenu={onSelectionContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneClick={(e) => {
            setContextMenu(null);
            if (textToolActive && !presenting) createTextAt(e.clientX, e.clientY);
          }}
          zoomOnDoubleClick={false}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          connectionMode={ConnectionMode.Loose}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionLineStyle={CONNECTION_LINE_STYLE}
          deleteKeyCode={["Backspace", "Delete"]}
          disableKeyboardA11y
          panOnDrag={selectModeActive ? false : pencilActive ? [1] : true}
          panOnScroll={pencilActive}
          panOnScrollSpeed={1}
          zoomOnScroll={!pencilActive}
          selectionOnDrag={selectModeActive}
          nodesDraggable={!pencilActive && !presenting && !handModeActive}
          nodesConnectable={!handModeActive}
          elementsSelectable={!presenting && !handModeActive}
          fitViewOptions={FIT_VIEW_OPTIONS}
          proOptions={{ hideAttribution: true }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        >
          {background === "lines" && <NotebookRules />}
          {background === "dots" && (
            <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} color={darkMode ? "#444455" : undefined} />
          )}
          {!presenting && footerZoomEl && createPortal(<ZoomControls />, footerZoomEl)}
          {!presenting && (
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => miniMapNodeColor(n, darkMode)}
              nodeStrokeColor={(n) => miniMapNodeStroke(n, darkMode)}
              nodeStrokeWidth={3}
              nodeBorderRadius={3}
              maskStrokeColor={darkMode ? "#9b7bff" : "#5f2fe0"}
              maskStrokeWidth={2}
            />
          )}
        </ReactFlow>
        </NotebookLinesContext.Provider>
        {previewPathD && (
          <svg className="freehand-preview">
            <path
              d={previewPathD}
              fill="none"
              stroke={penColor}
              strokeOpacity={pencilOptions.opacity}
              strokeWidth={pencilOptions.size}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {(guides.vertical.length > 0 || guides.horizontal.length > 0) && (
          <div className="alignment-guides">
            {guides.vertical.map((x, i) => (
              <div key={`v${i}`} className="guide-line guide-vertical" style={{ left: x * viewport.zoom + viewport.x }} />
            ))}
            {guides.horizontal.map((y, i) => (
              <div key={`h${i}`} className="guide-line guide-horizontal" style={{ top: y * viewport.zoom + viewport.y }} />
            ))}
          </div>
        )}
        {nodes
          .filter((n) => (n.data as { comment?: string }).comment !== undefined && n.id !== noteEditingId)
          .map((n) => {
            const w = n.measured?.width ?? Number(n.style?.width) ?? 140;
            return (
              <button
                key={n.id}
                className="comment-badge"
                style={{ left: n.position.x * viewport.zoom + viewport.x + w * viewport.zoom - 12, top: n.position.y * viewport.zoom + viewport.y - 12 }}
                onClick={() => setNoteEditingId(n.id)}
                title="View/edit note"
              >
                💬
              </button>
            );
          })}
        <AnimatePresence>
          {noteEditingId &&
            (() => {
              const n = nodes.find((x) => x.id === noteEditingId);
              if (!n) return null;
              const comment = (n.data as { comment?: string }).comment ?? "";
              return (
                <div key={noteEditingId} ref={commentFloating.setFloating} style={commentFloating.floatingStyles}>
                  <motion.div
                    className="comment-popover"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                  >
                    <textarea
                      autoFocus
                      defaultValue={comment}
                      placeholder="Note for this node…"
                      onBlur={(e) => {
                        setNodes((nds) =>
                          nds.map((x) => (x.id === noteEditingId ? { ...x, data: { ...x.data, comment: e.target.value } } : x))
                        );
                        setNoteEditingId(null);
                      }}
                    />
                  </motion.div>
                </div>
              );
            })()}
        </AnimatePresence>
        {nodes
          .filter((n) => (n.data as { link?: unknown }).link !== undefined && n.id !== linkEditingId)
          .map((n) => {
            const h = n.measured?.height ?? Number(n.style?.height) ?? 90;
            return (
              <button
                key={n.id}
                className="link-badge"
                style={{ left: n.position.x * viewport.zoom + viewport.x - 12, top: n.position.y * viewport.zoom + viewport.y + h * viewport.zoom - 12 }}
                onClick={() => navigateLink(n)}
                title="Follow link"
              >
                🔗
              </button>
            );
          })}
        <AnimatePresence>
        {linkEditingId &&
          (() => {
            const n = nodes.find((x) => x.id === linkEditingId);
            if (!n) return null;
            const link = (n.data as { link?: { type: "url" | "page"; value: string } }).link;
            return (
              <div key={linkEditingId} ref={linkFloating.setFloating} style={linkFloating.floatingStyles}>
              <motion.div
                className="link-popover"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
              >
                <label>
                  <input
                    type="radio"
                    checked={!link || link.type === "url"}
                    onChange={() =>
                      setNodes((nds) =>
                        nds.map((x) => (x.id === linkEditingId ? { ...x, data: { ...x.data, link: { type: "url", value: "" } } } : x))
                      )
                    }
                  />
                  URL
                </label>
                <label>
                  <input
                    type="radio"
                    checked={!!link && link.type === "page"}
                    onChange={() =>
                      setNodes((nds) =>
                        nds.map((x) =>
                          x.id === linkEditingId
                            ? { ...x, data: { ...x.data, link: { type: "page", value: pages.find((p) => p.id !== activePageId)?.id ?? activePageId } } }
                            : x
                        )
                      )
                    }
                  />
                  Page
                </label>
                {(!link || link.type === "url") && (
                  <input
                    autoFocus
                    type="text"
                    placeholder="https://example.com"
                    defaultValue={link?.value ?? ""}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      setNodes((nds) =>
                        nds.map((x) => {
                          if (x.id !== linkEditingId) return x;
                          if (!value) {
                            const { link: _removed, ...rest } = x.data as Record<string, unknown>;
                            return { ...x, data: rest };
                          }
                          return { ...x, data: { ...x.data, link: { type: "url", value } } };
                        })
                      );
                    }}
                  />
                )}
                {link?.type === "page" && (
                  <select
                    value={link.value}
                    onChange={(e) =>
                      setNodes((nds) =>
                        nds.map((x) =>
                          x.id === linkEditingId ? { ...x, data: { ...x.data, link: { type: "page", value: e.target.value } } } : x
                        )
                      )
                    }
                  >
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="link-popover-actions">
                  {/* Done stays first so it never shifts position: typing in
                      the URL field and clicking Done triggers a blur-save
                      just before the click lands, and if Remove link (only
                      shown once a link exists) sat before Done, that save
                      would insert it and push Done out from under the
                      in-flight click. */}
                  <button onClick={() => setLinkEditingId(null)}>Done</button>
                  {link && (
                    <button
                      onClick={() => {
                        removeLink(linkEditingId);
                        setLinkEditingId(null);
                      }}
                    >
                      Remove link
                    </button>
                  )}
                </div>
              </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>
        {/* A purely decorative overlay, not an animation of the canvas
            itself - React Flow swaps a presenting page's nodes/edges
            instantly (switchToPage), same as page tabs outside presentation
            mode. Keyed by activePageId so AnimatePresence re-triggers this
            fade on every page change: the outgoing instance fades back to
            covering the screen while the incoming one starts covering and
            fades away, masking that instant swap as a smooth transition
            without animating any node/edge/viewport state. */}
        {presenting && (
          <AnimatePresence>
            <motion.div
              key={activePageId}
              className="presentation-page-transition"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          </AnimatePresence>
        )}
        {focusMode && !presenting && (
          <button
            className="presentation-exit-top"
            onClick={() => setFocusMode(false)}
            title="Exit focus mode (Esc)"
            aria-label="Exit focus mode"
          >
            ×<span> Exit</span>
          </button>
        )}
        {presenting && (
          <button
            className="presentation-exit-top"
            onClick={() => setPresenting(false)}
            title="Exit presentation (Escape)"
            aria-label="Exit presentation"
          >
            ×<span> Exit</span>
          </button>
        )}
        {presenting && (
          <div className="presentation-controls">
            <button
              className="presentation-exit"
              onClick={() => setPresenting(false)}
              title="Exit presentation (Escape)"
            >
              × Exit
            </button>
            <button
              onClick={() => {
                const i = pages.findIndex((p) => p.id === activePageId);
                if (i > 0) switchToPage(pages[i - 1].id);
              }}
              disabled={pages.findIndex((p) => p.id === activePageId) <= 0}
            >
              ◀ Prev
            </button>
            <span className="presentation-page-indicator">
              {pages.findIndex((p) => p.id === activePageId) + 1} / {pages.length}
            </span>
            <button
              onClick={() => {
                const i = pages.findIndex((p) => p.id === activePageId);
                if (i < pages.length - 1) switchToPage(pages[i + 1].id);
              }}
              disabled={pages.findIndex((p) => p.id === activePageId) >= pages.length - 1}
            >
              Next ▶
            </button>
          </div>
        )}
        <AnimatePresence>
          {dataEditingId && (
            <DataPanel
              key={dataEditingId}
              node={nodes.find((n) => n.id === dataEditingId) ?? null}
              onChange={(patch) =>
                setNodes((nds) => nds.map((n) => (n.id === dataEditingId ? { ...n, data: { ...n.data, ...patch } } : n)))
              }
              onClose={() => setDataEditingId(null)}
              floatingRef={dataFloating.setFloating}
              floatingStyle={dataFloating.floatingStyles}
            />
          )}
        </AnimatePresence>
        {!presenting && showToolsPanel && (
          <ToolsPanel
            tools={[
              {
                key: "undo",
                icon: "undo",
                label: "Undo",
                tip: "Undo (Ctrl/Cmd+Z)",
                active: false,
                disabled: !historyFlags.undo,
                onClick: undo,
              },
              {
                key: "redo",
                icon: "redo",
                label: "Redo",
                tip: "Redo (Ctrl/Cmd+Shift+Z)",
                active: false,
                disabled: !historyFlags.redo,
                onClick: redo,
                separatorAfter: true,
              },
              {
                key: "shapes",
                icon: "shapes",
                label: "Shape library",
                tip: "Shapes & Widgets",
                active: shapesPanel.open && !shapesPanel.collapsed,
                onClick: () =>
                  setShapesPanel((p) => (!p.open || p.collapsed ? { open: true, collapsed: false } : { ...p, open: false })),
              },
              {
                key: "hand",
                icon: "hand",
                label: "Pan",
                tip: "Hand: drag the canvas to move around (H, Esc to exit)",
                active: handModeActive,
                onClick: onToggleHandMode,
              },
              {
                key: "select",
                icon: "select",
                label: "Marquee",
                tip: "Select: drag to select several shapes (Esc to exit)",
                active: selectModeActive,
                onClick: onToggleSelectMode,
              },
              {
                key: "pencil",
                icon: "pencil",
                label: "Freehand",
                tip: "Pencil: draw freehand (Esc to exit)",
                active: pencilActive,
                onClick: onTogglePencil,
              },
              {
                key: "text",
                icon: "textTool",
                label: "Type text",
                tip: "Text: click the canvas and type (T)",
                active: textToolActive,
                onClick: onToggleTextTool,
              },
              {
                key: "snap",
                icon: "grid",
                label: "Grid snapping",
                tip: "Snap to grid",
                active: gridSnapEnabled,
                onClick: () => setGridSnapEnabled((v) => !v),
              },
              ...(isBoard
                ? [
                    {
                      key: "focus",
                      icon: "focusEdit" as const,
                      label: "Edit full screen",
                      tip: "Focus mode: edit full screen (F)",
                      active: focusMode,
                      onClick: () => setFocusMode((f) => !f),
                      separatorBefore: true,
                    },
                  ]
                : []),
              {
                key: "present",
                icon: "present",
                label: "Present full screen",
                tip: "Present: show the board full screen (Esc to exit)",
                active: false,
                onClick: startPresentation,
                separatorBefore: !isBoard,
              },
            ]}
          />
        )}
        {!presenting && panelsReady && shapesPanel.open && (
          <ShapesDock
            collapsed={shapesPanel.collapsed}
            onToggleCollapsed={() => setShapesPanel((p) => ({ ...p, collapsed: !p.collapsed }))}
            onClose={() => setShapesPanel((p) => ({ ...p, open: false }))}
          >
            <ShapesPanel
              onAdd={addNode}
              customShapes={customShapes}
              onAddCustomShape={addCustomShapeNode}
              onUploadCustomShape={uploadCustomShape}
            />
          </ShapesDock>
        )}
        {!presenting && pencilActive && <PencilPanel
            options={{ ...pencilOptions, color: penColor }}
            isAuto={pencilOptions.color === AUTO_PEN}
            notebookLines={
              background !== "dots" ? { on: background === "lines", onToggle: toggleNotebookLines } : undefined
            }
            onChange={updatePencilOptions}
            selectedDrawings={selectedNodes.filter((n) => n.type === "freehand").length}
          />}
        {!presenting &&
          !pencilActive &&
          (selectedEdges.length > 0 ? (
            <EdgeStylePanel edges={selectedEdges} onChange={applyEdgeStylePatch} />
          ) : (
            <StylePanel nodes={selectedNodes} onChange={applyStylePatch} />
          ))}
        {!presenting && selectedEdges.length === 0 && selectedNodes.length >= 2 && (
          <AlignPanel selectionCount={selectedNodes.length} onAlign={alignSelection} onDistribute={distributeSelection} />
        )}
        {findOpen && (
          <FindReplacePanel
            query={findQuery}
            onQueryChange={setFindQuery}
            replacement={replaceQuery}
            onReplacementChange={setReplaceQuery}
            matchCount={findMatches.length}
            currentIndex={findIndex}
            onNext={findNext}
            onPrev={findPrev}
            onReplace={replaceCurrentMatch}
            onReplaceAll={replaceAllMatches}
            onClose={() => setFindOpen(false)}
          />
        )}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            actions={contextMenuActions}
            onClose={() => setContextMenu(null)}
          />
        )}
        {shortcutsOpen && <ShortcutsHelp onClose={() => setShortcutsOpen(false)} />}
        {historyOpen && (
          <VersionHistoryPanel
            diagramId={diagramId}
            onClose={() => setHistoryOpen(false)}
            onRestored={handleRestored}
          />
        )}
      </div>
      {!presenting && (
        <div className="canvas-footer">
          {!isWhiteboard && (
            <div className="page-tabs" role="group" aria-label="Pages">
              <div
                className="page-tabs-list"
                onDragOver={(e) => {
                  if (!dragPageId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const hint = pageDropTarget(e.currentTarget, e.clientX, dragPageId);
                  setDropHint((h) => (h?.id === hint?.id && h?.after === hint?.after ? h : hint));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  // Work out the target from where the pointer is right now, not from
                  // state that a fast drop may not have rendered yet.
                  const id = e.dataTransfer.getData("text/plain") || dragPageId;
                  const hint = id ? pageDropTarget(e.currentTarget, e.clientX, id) : null;
                  if (id && hint) reorderPage(id, hint.id, hint.after);
                  setDragPageId(null);
                  setDropHint(null);
                }}
              >
              {pages.map((p) => (
              <div
                key={p.id}
                data-page-id={p.id}
                className={`page-tab ${p.id === activePageId ? "active" : ""}${dragPageId === p.id ? " dragging" : ""}${
                  dropHint?.id === p.id ? (dropHint.after ? " drop-after" : " drop-before") : ""
                }`}
                draggable={editingPageId !== p.id}
                title="Drag to reorder"
                onDragStart={(e) => {
                  setDragPageId(p.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", p.id);
                }}
                onDragEnd={() => {
                  setDragPageId(null);
                  setDropHint(null);
                }}
              >
                {editingPageId === p.id ? (
                  <input
                    autoFocus
                    value={editingPageName}
                    onChange={(e) => setEditingPageName(e.target.value)}
                    onBlur={() => {
                      renamePage(p.id, editingPageName.trim() || p.name);
                      setEditingPageId(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                ) : (
                  <span
                    title="Click to open, double-click to rename"
                    onClick={() => switchToPage(p.id)}
                    onDoubleClick={() => {
                      setEditingPageId(p.id);
                      setEditingPageName(p.name);
                    }}
                  >
                    {p.name}
                  </span>
                )}
                <button
                  className="page-tab-close"
                  disabled={pages.length <= 1}
                  onClick={() => deletePage(p.id)}
                  aria-label={`Delete ${p.name}`}
                >
                  ×
                </button>
              </div>
            ))}
              </div>
              <button className="page-tab-add" onClick={addPage} title="Add a new page to this diagram">
                + Page
              </button>
            </div>
          )}
          <div className="canvas-footer-zoom" ref={setFooterZoomEl} />
        </div>
      )}
    </div>
  );
});

const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(props, ref) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});

export default Canvas;
