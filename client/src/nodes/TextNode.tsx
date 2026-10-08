// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Handle, Position, NodeResizer, useReactFlow } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { getTextStyle } from "./textStyle";
import { DEFAULT_FONT_SIZE } from "./shapeDefaults";
import { NotebookLinesContext } from "../contexts/NotebookLinesContext";

const MIN_AUTO_WIDTH = 80;

export default function TextNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  // A text box made by typing straight onto the canvas opens for typing.
  const createdByTyping = useRef((data as { autoEdit?: boolean }).autoEdit === true).current;
  const [editing, setEditing] = useState(createdByTyping);
  const text = (data as { text?: string }).text ?? "";
  // No explicit colour = Auto: black on a light canvas, white on a dark one.
  const explicitColor = (data as { color?: string }).color;
  const textStyle = getTextStyle(data as object, DEFAULT_FONT_SIZE);
  const locked = (data as { locked?: boolean }).locked ?? false;
  const colorStyle = explicitColor ? { color: explicitColor } : undefined;
  // Boxes made by typing (or from the Shapes panel) size their width to the
  // text too, up to a limit where it wraps - until you drag the width yourself.
  const autoWidth = (data as { autoWidth?: boolean }).autoWidth === true;
  const [draft, setDraft] = useState(text);
  const sizerRef = useRef<HTMLDivElement | null>(null);

  // A node is hidden until React Flow has measured it, and a hidden element
  // refuses focus - so keep trying for a moment instead of a single autoFocus.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (!editing) return;
    let frames = 0;
    let raf = 0;
    const tryFocus = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (document.activeElement === el) {
        el.setSelectionRange(el.value.length, el.value.length);
        return;
      }
      if (frames++ < 30) raf = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(raf);
  }, [editing]);

  // The "opens for typing" flag is one-shot: reloading must not reopen it.
  useEffect(() => {
    if (!createdByTyping) return;
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== id) return n;
        const { autoEdit: _drop, ...rest } = n.data as Record<string, unknown>;
        void _drop;
        return { ...n, data: rest };
      })
    );
  }, [createdByTyping, id, setNodes]);

  const updateText = (value: string) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== id) return n;
        // A box made by typing starts with explicit width/height props (so it is
        // visible and focusable at once); once typing ends the size lives in
        // `style`, like every other node.
        const { width: _w, height: _h, ...rest } = n;
        void _w;
        void _h;
        const h = typeof n.style?.height === "number" ? n.style.height : n.height;
        const w = typeof n.style?.width === "number" ? n.style.width : n.width;
        return {
          ...rest,
          style: { ...n.style, ...(h ? { height: h } : {}), ...(w ? { width: w } : {}) },
          data: { ...n.data, text: value },
        };
      })
    );
  };

  // The box height always fits its text: it grows as you type and shrinks when
  // text is removed (width is yours to set; the text wraps to it). On a ruled
  // White Board the height moves in whole ruled lines (32) so the box stays on
  // the rules.
  const ruled = useContext(NotebookLinesContext);
  const displayRef = useRef<HTMLDivElement | null>(null);
  const fitHeight = (needed: number) => {
    const next = ruled ? Math.max(32, Math.ceil(needed / 32) * 32) : Math.max(32, Math.ceil(needed));
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== id) return n;
        const current = typeof n.style?.height === "number" ? n.style.height : 0;
        // Ignore sub-pixel jitter, and don't shrink boxes saved at the old 40px
        // default just for being a few pixels roomy (opening a diagram must not edit it).
        const diff = next - current;
        if (diff > -9 && diff < 2) return n;
        return { ...n, height: n.height !== undefined ? next : n.height, style: { ...n.style, height: next } };
      })
    );
  };
  // Width: the text's natural (unwrapped) width, between a minimum that keeps
  // the box easy to hit and a maximum where long text wraps.
  const fitWidth = () => {
    const sizer = sizerRef.current;
    if (!autoWidth || !sizer) return;
    const next = Math.max(MIN_AUTO_WIDTH, Math.ceil(sizer.offsetWidth) + 6);
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== id) return n;
        const current = typeof n.style?.width === "number" ? n.style.width : n.width ?? 0;
        if (Math.abs(next - current) <= 1) return n;
        return { ...n, width: n.width !== undefined ? next : n.width, style: { ...n.style, width: next } };
      })
    );
  };
  const measureAndFit = () => {
    fitWidth();
    const ta = textareaRef.current;
    if (editing && ta) {
      ta.style.height = "auto";
      const needed = ta.scrollHeight;
      ta.style.height = "100%";
      fitHeight(needed);
    } else if (displayRef.current) {
      // The text block may be stretched to the current box height; measure its
      // natural height instead (same trick as the textarea above).
      const el = displayRef.current;
      const prev = el.style.height;
      el.style.height = "auto";
      const needed = el.scrollHeight;
      el.style.height = prev;
      fitHeight(needed);
    }
  };
  useLayoutEffect(() => {
    measureAndFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, draft, editing, ruled, autoWidth, JSON.stringify(textStyle)]);

  // Resizing the box's width re-wraps the text: refit when the width changes.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastWidthRef = useRef<number | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth);
      if (lastWidthRef.current === w) return;
      lastWidthRef.current = w;
      measureAndFit();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, ruled]);

  return (
    <div
      ref={rootRef}
      className={`text-node${explicitColor ? "" : " text-node-auto"}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!locked) {
          setDraft(text);
          setEditing(true);
        }
      }}
    >
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={60}
        minHeight={30}
        lineStyle={{ borderColor: "transparent" }}
        handleStyle={{ opacity: selected ? 1 : 0 }}
        // Dragging the width yourself turns automatic width off for this box.
        onResizeStart={() =>
          setNodes((nodes) =>
            nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, autoWidth: false } } : n))
          )
        }
      />
      {/* Invisible copy of the text, used to measure how wide it wants to be. */}
      <div ref={sizerRef} className="text-node-sizer" aria-hidden="true" style={textStyle}>
        {(editing ? draft : text) || (editing ? "" : "Double-click to add text")}
        {"\u200b"}
      </div>
      {locked && <span className="node-lock-badge">🔒</span>}
      {editing ? (
        <textarea
          ref={textareaRef}
          rows={1}
          className="text-node-textarea"
          defaultValue={text}
          style={{ ...textStyle, ...colorStyle }}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            // Esc commits (and leaves the text tool to a second Esc).
            if (e.key === "Escape") {
              e.stopPropagation();
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            const value = e.target.value;
            setEditing(false);
            // A box made by typing and left empty is discarded, not kept as a placeholder.
            if (createdByTyping && value.trim() === "") {
              setNodes((nodes) => nodes.filter((n) => n.id !== id));
              return;
            }
            updateText(value);
          }}
        />
      ) : (
        <div ref={displayRef} className="text-node-text" style={{ ...textStyle, ...colorStyle }}>{text || "Double-click to add text"}</div>
      )}
      <Handle type="source" position={Position.Top} id="top" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Left} id="left" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Right} id="right" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectableStart isConnectableEnd />
    </div>
  );
}
