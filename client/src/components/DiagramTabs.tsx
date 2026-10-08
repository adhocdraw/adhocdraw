// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { DiagramSummary } from "../api";
import { api } from "../api";
import ConfirmDialog from "./ConfirmDialog";

// Remembered across remounts of the strip (see the layout effect below).
let savedScrollLeft = 0;

interface DiagramTabsProps {
  currentId: string | null;
  unsavedId: string | null;
  onSelect: (id: string) => void;
  onDeleted: (id: string, remainingIds: string[]) => void;
  onListLoaded: (ids: string[]) => void;
  onRename: (id: string, name: string) => void;
  onUnsavedToFileChange: (ids: string[]) => void;
  refreshKey: number;
  // Shown in a dedicated slot at the right end of the tab pane (the save status).
  trailing?: ReactNode;
}

export default function DiagramTabs({ currentId, unsavedId, onSelect, onDeleted, onListLoaded, onRename, onUnsavedToFileChange, refreshKey, trailing }: DiagramTabsProps) {
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [unsavedToFile, setUnsavedToFile] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const cancelRenameRef = useRef(false);
  const diagramsRef = useRef(diagrams);
  diagramsRef.current = diagrams;

  // F2 renames the open diagram (same as double-clicking its tab name).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F2" || !currentId) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const d = diagramsRef.current.find((x) => x.id === currentId);
      if (!d) return;
      e.preventDefault();
      cancelRenameRef.current = false;
      setDraft(d.name);
      setEditingId(d.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentId]);
  const [deleteTarget, setDeleteTarget] = useState<DiagramSummary | null>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  // The native horizontal scrollbar sat on top of the tabs, so it is hidden;
  // the arrow buttons and the mouse wheel scroll the strip instead.
  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      observer.disconnect();
      el.removeEventListener("wheel", onWheel);
    };
  }, [updateScrollState, diagrams.length]);

  const scrollBy = (dir: -1 | 1) =>
    scrollerRef.current?.scrollBy({ left: dir * Math.max(200, (scrollerRef.current?.clientWidth ?? 0) * 0.6), behavior: "smooth" });

  // The server lists diagrams most-recently-saved first, which would shuffle
  // the tabs (and pull the diagram you just worked on to the front) after
  // every save or reload. Tabs go by creation order instead, so a diagram's
  // tab never moves; new diagrams land on the end.
  useEffect(() => {
    api
      .list()
      .then((list) => {
        const sorted = [...list].sort(
          (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id)
        );
        setDiagrams(sorted);
        onListLoaded(sorted.map((d) => d.id));
        // Which diagrams hold work that is not in a file the user saved.
        return api.listUnsavedToFile().then((ids) => {
          setUnsavedToFile(new Set(ids));
          onUnsavedToFileChange(ids);
        });
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Opening another diagram remounts this strip (it lives inside the canvas), which
  // would reset it to the start - so the scroll position is remembered across
  // mounts, restored once the tabs are in, and the active tab is only scrolled
  // into view if it ended up outside the visible part (the least that shows it).
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || diagrams.length === 0) return;
    if (!restoredRef.current) {
      scroller.scrollLeft = savedScrollLeft;
      restoredRef.current = true;
    }
    const tab = activeRef.current;
    if (tab) {
      const s = scroller.getBoundingClientRect();
      const t = tab.getBoundingClientRect();
      const PAD = 8;
      if (t.left < s.left + PAD) scroller.scrollLeft -= s.left + PAD - t.left;
      else if (t.right > s.right - PAD) scroller.scrollLeft += t.right - (s.right - PAD);
    }
    savedScrollLeft = scroller.scrollLeft;
    updateScrollState();
  }, [currentId, diagrams.length, updateScrollState]);

  // In the browser-only build, closing a tab discards that diagram's copy in
  // this browser (a file the user saved is untouched). That is only worth a
  // warning when something would actually be lost: content that is not in a
  // file they saved or opened, or an edit still waiting to autosave.
  const unsavedIdRef = useRef(unsavedId);
  unsavedIdRef.current = unsavedId;

  const commitRename = (d: DiagramSummary) => {
    const next = draft.trim();
    setEditingId(null);
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    if (!next || next === d.name) return;
    setDiagrams((prev) => prev.map((x) => (x.id === d.id ? { ...x, name: next } : x)));
    onRename(d.id, next);
  };

  const requestClose = async (d: DiagramSummary) => {
    // Closing a tab removes the diagram from this browser. An edit still waiting
    // for its autosave isn't in storage yet; let it land (up to a couple of
    // seconds) so the check below sees it.
    for (let waited = 0; unsavedIdRef.current === d.id && waited < 2000; waited += 100) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!(await api.hasUnsavedWork(d.id).catch(() => true))) {
      await removeDiagram(d.id);
      return;
    }
    setDeleteTarget(d);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await removeDiagram(id);
  };

  const removeDiagram = async (id: string) => {
    await api.remove(id);
    const remaining = diagrams.filter((d) => d.id !== id);
    setDiagrams(remaining);
    onDeleted(
      id,
      remaining.map((d) => d.id)
    );
  };

  return (
    <div className="diagram-tabs-wrap">
      <button
        type="button"
        className="diagram-tabs-arrow"
        aria-label="Scroll tabs left"
        disabled={!canScroll.left}
        onClick={() => scrollBy(-1)}
      >
        ‹
      </button>
      <div className="diagram-tabs" role="tablist" aria-label="Diagrams" ref={scrollerRef} onScroll={() => {
          if (scrollerRef.current) savedScrollLeft = scrollerRef.current.scrollLeft;
          updateScrollState();
        }}>
      {diagrams.map((d) => (
        <div
          key={d.id}
          ref={d.id === currentId ? activeRef : undefined}
          role="tab"
          aria-selected={d.id === currentId}
          className={`diagram-tab ${d.id === currentId ? "active" : ""}`}
          onClick={() => onSelect(d.id)}
        >
          {editingId === d.id ? (
            <input
              className="diagram-tab-input"
              autoFocus
              value={draft}
              aria-label={`Rename ${d.name}`}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onBlur={() => commitRename(d)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  cancelRenameRef.current = true;
                  e.currentTarget.blur();
                }
              }}
            />
          ) : (
            <span
              className="diagram-tab-name"
              title="Double-click to rename"
              onDoubleClick={(e) => {
                e.stopPropagation();
                cancelRenameRef.current = false;
                setDraft(d.name);
                setEditingId(d.id);
              }}
            >
              {d.name}
            </span>
          )}
          {unsavedToFile.has(d.id) && (
            <span
              className="diagram-tab-unsaved"
              role="img"
              aria-label="Not saved to a file yet"
              title="Not saved to a file yet - use Save to file to keep a copy"
            >
              ●
            </span>
          )}
          <button
            type="button"
            className="diagram-tab-close"
            title="Close diagram"
            aria-label={`Close ${d.name}`}
            onClick={(e) => {
              e.stopPropagation();
              requestClose(d);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Close diagram"
        description={`"${deleteTarget?.name ?? ""}" has changes that aren't saved to a file. Closing it removes it from this browser. Use Save to file first to keep a copy.`}
        confirmLabel="Close anyway"
        onConfirm={confirmDelete}
      />
      </div>
      <button
        type="button"
        className="diagram-tabs-arrow"
        aria-label="Scroll tabs right"
        disabled={!canScroll.right}
        onClick={() => scrollBy(1)}
      >
        ›
      </button>
      {trailing !== undefined && (
        <div className="diagram-tabs-status">
          <span className="focus-diagram-name" aria-hidden="true" data-name={diagrams.find((d) => d.id === currentId)?.name ?? ""} />
          {trailing}
        </div>
      )}
    </div>
  );
}
