// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import DiagramTabs from "./components/DiagramTabs";
import NewDiagramMenu from "./components/NewDiagramMenu";
import OpenFileButton from "./components/OpenFileButton";
import AboutDialog from "./components/AboutDialog";
import Tooltips from "./components/Tooltips";
import Logo from "./components/Logo";
import { openRepo, SITE_URL } from "./links";
import Icon from "./components/Icon";
import Canvas from "./components/Canvas";
import type { CanvasHandle } from "./components/Canvas";
import type { SaveStatus } from "./components/Canvas";
import { api } from "./api";
import type { DiagramData } from "./api";
import { TEMPLATES } from "./templates";
import { fingerprint } from "./fingerprint";
import type { FileWithHandle } from "browser-fs-access";
import { ToastProvider } from "./contexts/ToastContext";
import "./App.css";

const LAST_DIAGRAM_KEY = "adhocdraw.lastDiagramId";

export default function App() {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [theme, setTheme] = useState<"classic" | "palette">(() =>
    localStorage.getItem("theme") === "palette" ? "palette" : "classic"
  );
  const [aboutOpen, setAboutOpen] = useState(false);
  const [unsavedToFile, setUnsavedToFile] = useState<string[]>([]);
  const canvasRef = useRef<CanvasHandle>(null);
  const [pencilActive, setPencilActive] = useState(false);
  const [selectModeActive, setSelectModeActive] = useState(false);
  const [textToolActive, setTextToolActive] = useState(false);
  const [handModeActive, setHandModeActive] = useState(false);
  const [eraserActive, setEraserActive] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  // The local file handle a diagram was opened from (via "Open from file…"),
  // if any and if the browser supports the File System Access API - lets
  // "Save to File" write back to that same file instead of always prompting
  // a fresh download. Tied to whichever diagram is open; cleared whenever the
  // user switches to a diagram that wasn't opened from a local file.
  const [fileHandle, setFileHandle] = useState<FileWithHandle["handle"]>(undefined);

  useEffect(() => {
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Closing or reloading the page would only keep the browser copy; warn when
  // some diagram has work that is not in a file the user saved.
  useEffect(() => {
    if (unsavedToFile.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsavedToFile]);

  // Remember the diagram being worked on so the next visit reopens it.
  useEffect(() => {
    try {
      if (currentId) localStorage.setItem(LAST_DIAGRAM_KEY, currentId);
    } catch {
      // Storage unavailable - just won't be remembered.
    }
  }, [currentId]);

  const handleCreate = async (name: string, templateKey: string) => {
    const template = TEMPLATES.find((t) => t.key === templateKey) ?? TEMPLATES[0];
    // New diagrams are created without asking for a name (rename in the title
    // box); keep the default name unique so the tabs can be told apart.
    const taken = new Set((await api.list().catch(() => [])).map((d) => d.name));
    let n = 1;
    while (taken.has(`${name} ${n}`)) n++;
    const unique = `${name} ${n}`;
    const diagram = await api.create(unique, template.build());
    setRefreshKey((k) => k + 1);
    setFileHandle(undefined);
    setCurrentId(diagram.id);
    if (template.startsWithPencil) {
      setSelectModeActive(false);
      setTextToolActive(false);
      setHandModeActive(false);
      setEraserActive(false);
      setPencilActive(true);
    }
  };

  const handleImport = async (name: string, data: DiagramData, handle: FileWithHandle["handle"]) => {
    const diagram = await api.create(name, data);
    // Just opened from a file, so that file already holds exactly this.
    await api.markSavedToFile(diagram.id, fingerprint(data));
    setRefreshKey((k) => k + 1);
    setFileHandle(handle);
    setCurrentId(diagram.id);
  };

  const handleSelectDiagram = (id: string) => {
    setFileHandle(undefined);
    setCurrentId(id);
  };

  // With no diagram open, open the one last worked on, else the first tab.
  const handleListLoaded = (ids: string[]) => {
    if (ids.length === 0) return;
    setCurrentId((current) => {
      if (current) return current;
      let last: string | null = null;
      try {
        last = localStorage.getItem(LAST_DIAGRAM_KEY);
      } catch {
        // ignore
      }
      return last && ids.includes(last) ? last : ids[0];
    });
  };

  // Renaming from a tab. The open diagram's canvas keeps its own copy of the
  // name (and autosaves it), so the rename goes through it - writing to storage
  // directly would just be overwritten by its next save.
  const handleRename = async (id: string, name: string) => {
    if (id === currentId && canvasRef.current) canvasRef.current.rename(name);
    else await api.update(id, { name });
    setRefreshKey((k) => k + 1);
  };

  const handleDiagramDeleted = (id: string, remainingIds: string[]) => {
    if (id === currentId) setCurrentId(remainingIds[0] ?? null);
  };

  const handleTogglePencil = () => {
    setEraserActive(false);
    setSelectModeActive(false);
    setTextToolActive(false);
    setHandModeActive(false);
    setPencilActive((a) => !a);
  };

  const handleToggleSelectMode = () => {
    setEraserActive(false);
    setPencilActive(false);
    setTextToolActive(false);
    setHandModeActive(false);
    setSelectModeActive((a) => !a);
  };

  const handleToggleTextTool = () => {
    setEraserActive(false);
    setPencilActive(false);
    setSelectModeActive(false);
    setHandModeActive(false);
    setTextToolActive((a) => !a);
  };

  const handleToggleEraser = () => {
    setPencilActive(false);
    setSelectModeActive(false);
    setTextToolActive(false);
    setHandModeActive(false);
    setEraserActive((a) => !a);
  };

  const handleToggleHandMode = () => {
    setEraserActive(false);
    setPencilActive(false);
    setSelectModeActive(false);
    setTextToolActive(false);
    setHandModeActive((a) => !a);
  };

  const newDiagramMenu = (
    <>
      <NewDiagramMenu onCreate={handleCreate} />
      <OpenFileButton onImport={handleImport} />
    </>
  );
  const needsFileSave = !!currentId && unsavedToFile.includes(currentId);
  const savedNotInFile = saveStatus === "saved" && needsFileSave;
  const statusLabel = (
    <span
      className={`save-status save-status-${saveStatus}${savedNotInFile ? " save-status-file" : ""}`}
      title={savedNotInFile ? "Saved in this browser · not saved to a file" : undefined}
    >
      {saveStatus === "saved" && (needsFileSave ? "Saved in this browser · not saved to a file" : "Saved")}
      {saveStatus === "saving" && "Saving..."}
      {saveStatus === "unsaved" && "Unsaved changes"}
    </span>
  );
  const diagramTabs = (
    <DiagramTabs
      currentId={currentId}
      unsavedId={currentId && saveStatus !== "saved" ? currentId : null}
      onSelect={handleSelectDiagram}
      onDeleted={handleDiagramDeleted}
      onRename={handleRename}
      onUnsavedToFileChange={setUnsavedToFile}
      onListLoaded={handleListLoaded}
      refreshKey={refreshKey}
      trailing={currentId ? statusLabel : undefined}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <div className={`app${darkMode ? " dark" : ""}${theme === "palette" ? " theme-palette" : ""}`}>
          {currentId ? (
            <Canvas
              key={currentId}
              ref={canvasRef}
              diagramId={currentId}
              onLoaded={({ whiteboard }) => {
                // A White Board opens (and re-opens after a reload) with the Pencil on.
                if (whiteboard) {
                  setSelectModeActive(false);
                  setTextToolActive(false);
                  setHandModeActive(false);
                  setEraserActive(false);
                  setPencilActive(true);
                }
              }}
              onSaved={() => setRefreshKey((k) => k + 1)}
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode((d) => !d)}
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === "palette" ? "classic" : "palette"))}
              pencilActive={pencilActive}
              onExitPencilMode={() => setPencilActive(false)}
              onTogglePencil={handleTogglePencil}
              eraserActive={eraserActive}
              onExitEraser={() => setEraserActive(false)}
              onToggleEraser={handleToggleEraser}
              handModeActive={handModeActive}
              onExitHandMode={() => setHandModeActive(false)}
              onToggleHandMode={handleToggleHandMode}
              textToolActive={textToolActive}
              onExitTextTool={() => setTextToolActive(false)}
              onToggleTextTool={handleToggleTextTool}
              selectModeActive={selectModeActive}
              onExitSelectMode={() => setSelectModeActive(false)}
              onToggleSelectMode={handleToggleSelectMode}
              onSaveStatusChange={setSaveStatus}
              needsFileSave={needsFileSave}
              fileHandle={fileHandle}
              onFileHandleChange={setFileHandle}
              leadingActions={newDiagramMenu}
              onOpenAbout={() => setAboutOpen(true)}
              diagramTabs={diagramTabs}
            />
          ) : (
            <div className="canvas-area">
              <div className="canvas-header">
                <div className="canvas-header-top">
                  <a className="brand" href={SITE_URL} target="_blank" rel="noopener noreferrer" title="AdhocDraw website"><Logo /></a>
                  <div className="canvas-header-meta toolbar-group group-app" role="group" aria-label="App">
                    <button
                      onClick={() => setDarkMode((d) => !d)}
                      title={darkMode ? "Switch to the light theme" : "Switch to the dark theme"}
                      aria-label={darkMode ? "Light mode" : "Dark mode"}
                    >
                      <Icon name={darkMode ? "sun" : "moon"} />
                    </button>
                    <button
                      onClick={() => setTheme((t) => (t === "palette" ? "classic" : "palette"))}
                      title={theme === "palette" ? "Switch to the Classic theme" : "Switch to the Palette theme"}
                      aria-label={theme === "palette" ? "Theme: Palette" : "Theme: Classic"}
                    >
                      <Icon name="palette" />
                    </button>
                    <button
                      onClick={openRepo}
                      title="Source code on GitHub (opens in a new tab)"
                      aria-label="AdhocDraw on GitHub"
                    >
                      <Icon name="github" />
                    </button>
                    <button onClick={() => setAboutOpen(true)} title="About, privacy and open-source licenses">
                      <Icon name="info" />
                      About
                    </button>
                  </div>
                </div>
                <div className="canvas-header-actions">
                  <div className="toolbar-cluster">
                    <span className="toolbar-caption caption-file" aria-hidden="true">File</span>
                    <div className="toolbar-group group-file" role="group" aria-label="File">
                      {newDiagramMenu}
                    </div>
                  </div>
                </div>
              </div>
              {diagramTabs}
              <div className="empty-state">Select or create a diagram to start brainstorming.</div>
            </div>
          )}
        </div>
        {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
        <Tooltips />
      </ToastProvider>
    </MotionConfig>
  );
}
