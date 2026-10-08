// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { v4 as uuid } from "uuid";
import type { Diagram, DiagramData, DiagramSummary, DiagramVersionSummary } from "./api";
import { fingerprint, isEmptyDiagram } from "./fingerprint";

// Browser-only storage for the hosted, no-server build: diagrams live in the
// user's own IndexedDB, never on any server. Falls back to memory (lost on
// refresh) if the browser blocks IndexedDB, e.g. some private-browsing modes.

const DB_NAME = "adhocdraw";
const MAX_VERSIONS_PER_DIAGRAM = 50;
const MAX_IMAGE_EDGE = 1600;

interface VersionRecord {
  id: string;
  diagram_id: string;
  label: string;
  data: DiagramData;
  created_at: string;
}

interface Backend {
  all<T>(store: "diagrams" | "versions"): Promise<T[]>;
  get<T>(store: "diagrams" | "versions", id: string): Promise<T | undefined>;
  put(store: "diagrams" | "versions", value: { id: string }): Promise<void>;
  del(store: "diagrams" | "versions", id: string): Promise<void>;
}

function memoryBackend(): Backend {
  const stores = { diagrams: new Map<string, unknown>(), versions: new Map<string, unknown>() };
  return {
    all: async <T,>(s: "diagrams" | "versions") => [...stores[s].values()] as T[],
    get: async <T,>(s: "diagrams" | "versions", id: string) => stores[s].get(id) as T | undefined,
    put: async (s, v) => void stores[s].set(v.id, structuredClone(v)),
    del: async (s, id) => void stores[s].delete(id),
  };
}

function idbBackend(db: IDBDatabase): Backend {
  const run = <T,>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> =>
    new Promise((resolve, reject) => {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  return {
    all: <T,>(s: "diagrams" | "versions") => run<T[]>(s, "readonly", (st) => st.getAll()),
    get: <T,>(s: "diagrams" | "versions", id: string) => run<T | undefined>(s, "readonly", (st) => st.get(id)),
    put: async (s, v) => void (await run(s, "readwrite", (st) => st.put(v))),
    del: async (s, id) => void (await run(s, "readwrite", (st) => st.delete(id))),
  };
}

let backendPromise: Promise<Backend> | null = null;
function backend(): Promise<Backend> {
  backendPromise ??= new Promise<Backend>((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("diagrams", { keyPath: "id" });
        req.result.createObjectStore("versions", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(idbBackend(req.result));
      req.onerror = () => resolve(memoryBackend());
      req.onblocked = () => resolve(memoryBackend());
    } catch {
      resolve(memoryBackend());
    }
  });
  return backendPromise;
}

const summary = (d: Diagram): DiagramSummary => ({
  id: d.id,
  name: d.name,
  created_at: d.created_at,
  updated_at: d.updated_at,
});

async function requireDiagram(id: string): Promise<Diagram> {
  const d = await (await backend()).get<Diagram>("diagrams", id);
  if (!d) throw new Error("diagram not found");
  return d;
}

// Large photos would bloat the saved file and the browser's storage, so
// raster images wider/taller than MAX_IMAGE_EDGE are scaled down first.
// SVGs and small images are stored as they are.
async function toDataUrl(file: File | Blob): Promise<string> {
  const read = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return read(file);
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) return read(file);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(file.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.9);
  } catch {
    return read(file);
  }
}

export const localApi = {
  list: async (): Promise<DiagramSummary[]> => {
    const all = await (await backend()).all<Diagram>("diagrams");
    return all.map(summary).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },

  get: async (id: string): Promise<Diagram> => structuredClone(await requireDiagram(id)),

  create: async (name: string, data: DiagramData): Promise<Diagram> => {
    const now = new Date().toISOString();
    const diagram: Diagram = { id: uuid(), name, data, created_at: now, updated_at: now };
    await (await backend()).put("diagrams", diagram);
    return diagram;
  },

  update: async (id: string, fields: { name?: string; data?: DiagramData }): Promise<Diagram> => {
    const existing = await requireDiagram(id);
    const next: Diagram = {
      ...existing,
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.data !== undefined ? { data: fields.data } : {}),
      updated_at: new Date().toISOString(),
    };
    await (await backend()).put("diagrams", next);
    return next;
  },

  remove: async (id: string): Promise<void> => {
    const b = await backend();
    await b.del("diagrams", id);
    const versions = (await b.all<VersionRecord>("versions")).filter((v) => v.diagram_id === id);
    await Promise.all(versions.map((v) => b.del("versions", v.id)));
  },

  listVersions: async (diagramId: string): Promise<DiagramVersionSummary[]> =>
    (await (await backend()).all<VersionRecord>("versions"))
      .filter((v) => v.diagram_id === diagramId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ id, label, created_at }) => ({ id, label, created_at })),

  saveVersion: async (diagramId: string, label?: string): Promise<DiagramVersionSummary> => {
    const b = await backend();
    const diagram = await requireDiagram(diagramId);
    const record: VersionRecord = {
      id: uuid(),
      diagram_id: diagramId,
      label: label || "Version",
      data: structuredClone(diagram.data),
      created_at: new Date().toISOString(),
    };
    await b.put("versions", record);
    const mine = (await b.all<VersionRecord>("versions"))
      .filter((v) => v.diagram_id === diagramId)
      .sort((a, c) => c.created_at.localeCompare(a.created_at));
    await Promise.all(mine.slice(MAX_VERSIONS_PER_DIAGRAM).map((v) => b.del("versions", v.id)));
    return { id: record.id, label: record.label, created_at: record.created_at };
  },

  restoreVersion: async (diagramId: string, versionId: string): Promise<Diagram> => {
    const b = await backend();
    const version = await b.get<VersionRecord>("versions", versionId);
    if (!version || version.diagram_id !== diagramId) throw new Error("version not found");
    const existing = await requireDiagram(diagramId);
    const next: Diagram = { ...existing, data: structuredClone(version.data), updated_at: new Date().toISOString() };
    await b.put("diagrams", next);
    return next;
  },

  // Remembers what the diagram looked like when it was last written to (or
  // opened from) a file on the user's disk, so closing it can tell whether
  // anything would be lost.
  markSavedToFile: async (id: string, fileFingerprint: string): Promise<void> => {
    const existing = await requireDiagram(id);
    await (await backend()).put("diagrams", { ...existing, file_fingerprint: fileFingerprint } as Diagram);
  },

  // True when closing the diagram would lose work: it has content that is
  // not in a file the user saved or opened.
  hasUnsavedWork: async (id: string): Promise<boolean> => {
    const d = (await requireDiagram(id)) as Diagram & { file_fingerprint?: string };
    if (isEmptyDiagram(d.data)) return false;
    return d.file_fingerprint !== fingerprint(d.data);
  },

  // Ids of every diagram with content that is not in a file the user saved or
  // opened - what the tabs flag with a dot.
  listUnsavedToFile: async (): Promise<string[]> => {
    const all = await (await backend()).all<Diagram & { file_fingerprint?: string }>("diagrams");
    return all
      .filter((d) => !isEmptyDiagram(d.data) && d.file_fingerprint !== fingerprint(d.data))
      .map((d) => d.id);
  },

  // Images are embedded in the diagram itself as data URLs - nothing is
  // uploaded anywhere, and a saved .json file stays self-contained.
  uploadImage: async (file: File | Blob): Promise<{ url: string }> => ({ url: await toDataUrl(file) }),
};
