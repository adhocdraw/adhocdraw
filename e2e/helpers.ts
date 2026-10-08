// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

// ---- the app's own browser storage (IndexedDB "adhocdraw") ----------------------
// Tests start with an empty browser each time. These helpers put diagrams straight
// into storage (so a test does not have to build them through the UI) and read what
// the app saved back out.
export interface StoredDiagram {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  data: {
    pages: { id: string; name: string; nodes: { position: { x: number; y: number }; [k: string]: unknown }[]; edges: unknown[] }[];
    [k: string]: unknown;
  };
}

// Adds an empty diagram to the browser's storage and returns its id. The app must
// be reloaded (e.g. page.goto("/")) to show it.
export async function seedDiagram(page: Page, name: string): Promise<string> {
  if (page.url() === "about:blank") await page.goto("/");
  return page.evaluate(
    (n) =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open("adhocdraw", 1);
        open.onupgradeneeded = () => {
          for (const store of ["diagrams", "versions"]) {
            if (!open.result.objectStoreNames.contains(store)) open.result.createObjectStore(store, { keyPath: "id" });
          }
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const id = crypto.randomUUID();
          const now = new Date().toISOString();
          const record = {
            id,
            name: n,
            created_at: now,
            updated_at: now,
            data: { pages: [{ id: crypto.randomUUID(), name: "Page 1", nodes: [], edges: [] }], customShapes: [] },
          };
          const tx = open.result.transaction("diagrams", "readwrite");
          tx.objectStore("diagrams").put(record);
          tx.oncomplete = () => resolve(id);
          tx.onerror = () => reject(tx.error);
        };
      }),
    name
  );
}

// Everything the app has saved so far.
export async function readDiagrams(page: Page): Promise<StoredDiagram[]> {
  return page.evaluate(
    () =>
      new Promise<StoredDiagram[]>((resolve) => {
        const open = indexedDB.open("adhocdraw", 1);
        open.onsuccess = () => {
          if (!open.result.objectStoreNames.contains("diagrams")) return resolve([]);
          const q = open.result.transaction("diagrams").objectStore("diagrams").getAll();
          q.onsuccess = () => resolve(q.result as StoredDiagram[]);
        };
        open.onerror = () => resolve([]);
      })
  );
}

export async function readDiagram(page: Page, idOrName: string): Promise<StoredDiagram | undefined> {
  return (await readDiagrams(page)).find((d) => d.id === idOrName || d.name === idOrName);
}

// Stubs `window.showOpenFilePicker`/`showSaveFilePicker` before the page
// loads. Real Chromium exposes these (so browser-fs-access always picks its
// "modern" File System Access API path over the download/input fallback),
// but headless/automated Chromium can't actually display the native OS
// dialogs they open - a real click just hangs forever with no event
// Playwright can wait on. Must be called before the page's first navigation
// (addInitScript only applies to loads that happen after it's registered).
// Reads what to hand back from `window.__mockOpenFile` (set via
// page.evaluate before clicking "Open from file…") and records what got
// written from "Save to file" onto `window.__lastSavedFile`.
export async function mockFileSystemAccess(page: Page) {
  await page.addInitScript(() => {
    function makeOpenHandle() {
      const { name, content } = (window as unknown as { __mockOpenFile: { name: string; content: string } }).__mockOpenFile;
      return {
        kind: "file" as const,
        name,
        async getFile() {
          return new File([content], name, { type: "application/json" });
        },
        async queryPermission() {
          return "granted";
        },
        async requestPermission() {
          return "granted";
        },
      };
    }
    (window as unknown as { showOpenFilePicker: () => Promise<unknown[]> }).showOpenFilePicker = async () => [
      makeOpenHandle(),
    ];
    (window as unknown as { showSaveFilePicker: (opts: { suggestedName?: string }) => Promise<unknown> }).showSaveFilePicker =
      async (opts) => {
        const name = opts?.suggestedName || "Untitled";
        let lastChunks: string[] = [];
        return {
          kind: "file" as const,
          name,
          async getFile() {
            return new File(lastChunks, name);
          },
          async createWritable() {
            // A fresh array per call - `createWritable` is called again on
            // every subsequent save to the same handle, and would otherwise
            // append onto the previous save's already-written content.
            const chunks: string[] = [];
            lastChunks = chunks;
            return new WritableStream<Uint8Array>({
              write(chunk) {
                chunks.push(new TextDecoder().decode(chunk));
              },
              close() {
                (window as unknown as { __lastSavedFile: { name: string; content: string } }).__lastSavedFile = {
                  name,
                  content: chunks.join(""),
                };
              },
            });
          },
          async queryPermission() {
            return "granted";
          },
          async requestPermission() {
            return "granted";
          },
        };
      };
  });
}

export async function openDiagram(page: Page, name: string) {
  await page.goto("/");
  // Every saved diagram is a tab above the canvas.
  await page.getByText(name, { exact: true }).click();
  await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(name);
}

// Opens the toolbar's "New" flyout (name field + templates).
// Opens the toolbar's "Export" flyout (PNG, SVG, PDF).
export async function openExportMenu(page: Page) {
  await page.getByRole("button", { name: /^Export/ }).click();
}

export async function openNewDiagramMenu(page: Page) {
  await page.getByRole("button", { name: /^New/ }).click();
  await expect(page.locator(".new-diagram-flyout")).toBeVisible();
}

// Creates a diagram from the New menu (a template, default Blank) and gives it
// a name - the menu itself no longer asks for one, so it is renamed afterwards
// in the title box.
// Default names are "<option> <n>", e.g. Chart 1, White Board 2.
export const DEFAULT_NAME = /^(Chart|White Board|Notebook) \d+$/;

// Renames the open diagram by double-clicking its tab name (F2 does the same).
export async function renameActiveDiagram(page: Page, name: string) {
  await page.locator(".diagram-tab.active .diagram-tab-name").dblclick();
  const input = page.locator(".diagram-tab-input");
  await expect(input).toBeFocused();
  await input.fill(name);
  await input.press("Enter");
}

export async function createDiagramFromMenu(page: Page, name: string, template = "Blank Chart") {
  const title = page.locator(".diagram-tab.active .diagram-tab-name");
  // With a diagram already open (or auto-opened on load), wait for the *new*
  // one to replace it before renaming, or the rename would hit the wrong one.
  const before = (await title.isVisible()) ? await title.innerText() : null;
  await openNewDiagramMenu(page);
  await page.locator(".flyout-item", { hasText: new RegExp(`^${template}$`) }).click();
  await expect(title).toHaveText(DEFAULT_NAME);
  if (before !== null && DEFAULT_NAME.test(before)) await expect(title).not.toHaveText(before);
  await renameActiveDiagram(page, name);
  await expect(page.locator(".diagram-tab.active")).toContainText(name, { timeout: 8000 });
}

// Makes sure the floating Shapes & Widgets panel is open and expanded.
export async function openShapesPanel(page: Page) {
  if (!(await page.locator(".shapes-panel").isVisible())) {
    await page.locator(".shapes-toggle").click();
  }
  await expect(page.locator(".shapes-panel")).toBeVisible();
}

export async function addWidget(page: Page, label: string) {
  await openShapesPanel(page);
  const before = await page.locator(".react-flow__node").count();
  await page.locator(".shapes-panel").getByRole("button", { name: label }).dblclick();
  await expect(page.locator(".react-flow__node")).toHaveCount(before + 1);
  // The panel floats over the left of the canvas; tuck it away so it never
  // sits on top of anything a test does next (the next addWidget reopens it).
  await page.locator(".shapes-dock-close").click();
  // .last() is a live query - it would silently re-point to a different node
  // once more nodes are added later. Pin the new node by its stable data-id
  // instead, so the returned locator keeps identifying THIS node throughout
  // the rest of the test.
  const id = await page.locator(".react-flow__node").last().getAttribute("data-id");
  return page.locator(`.react-flow__node[data-id="${id}"]`);
}

// Adding a widget (especially a Frame, much bigger on-screen than other
// widgets) can queue an async zoom/fit recalculation that only resolves once
// every current node has reported its measured size. Any position computed
// before that settles can be stale by the time it's actually applied.
// Call this once after all the widgets a test needs have been added, and
// before computing any position-dependent target, to force one deterministic
// fit and wait for it to finish.
export async function settleLayout(page: Page) {
  await page.getByRole("button", { name: "Fit View" }).click();
  await page.waitForTimeout(300);
}

// Repositions each given node to its own safe, non-overlapping slot: a
// two-column layout sized from the CURRENT (post-settle) canvas and node
// dimensions, so it works regardless of zoom level and widget size (a Frame
// is much larger on-screen than other widgets). Call settleLayout() first.
export async function spreadNodes(page: Page, nodes: Locator[]) {
  const canvasBox = await page.locator(".canvas-flow").boundingBox();
  if (!canvasBox) throw new Error("canvas not found");
  for (let i = 0; i < nodes.length; i++) {
    const nodeBox = await nodes[i].boundingBox();
    if (!nodeBox) throw new Error("node not found");
    const margin = 30;
    const halfW = nodeBox.width / 2;
    const halfH = nodeBox.height / 2;
    const minX = canvasBox.x + halfW + margin;
    const maxX = canvasBox.x + canvasBox.width - halfW - margin;
    const minY = canvasBox.y + halfH + margin;
    const maxY = canvasBox.y + canvasBox.height - halfH - margin;
    const slot = i % 2;
    const targetX = minX <= maxX ? (slot === 0 ? minX : maxX) : (minX + maxX) / 2;
    const targetY = (minY + maxY) / 2;
    await dragNodeTo(page, nodes[i], targetX, targetY);
    await page.waitForTimeout(50);
  }
}

// Retries internally: a single mouse-drag connection attempt occasionally
// doesn't register in headless automation (real browser timing noise on an
// async-layout canvas), so this checks the edge count actually increased and
// re-attempts the drag if not, rather than every call site needing its own
// retry wrapper.
export async function dragHandle(page: Page, from: Locator, fromPos: string, to: Locator, toPos: string) {
  await expect(async () => {
    const before = await page.locator(".react-flow__edge").count();
    const fromBox = await from.locator(`[data-handlepos="${fromPos}"]`).boundingBox();
    const toBox = await to.locator(`[data-handlepos="${toPos}"]`).boundingBox();
    if (!fromBox || !toBox) throw new Error("handle bounding box not found");
    const fx = fromBox.x + fromBox.width / 2;
    const fy = fromBox.y + fromBox.height / 2;
    const tx = toBox.x + toBox.width / 2;
    const ty = toBox.y + toBox.height / 2;
    await page.mouse.move(fx, fy);
    await page.mouse.down();
    await page.mouse.move((fx + tx) / 2, (fy + ty) / 2, { steps: 5 });
    await page.mouse.move(tx, ty, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator(".react-flow__edge")).toHaveCount(before + 1);
  }).toPass({ timeout: 10000 });
}

export async function dragNodeBy(page: Page, node: Locator, dx: number, dy: number) {
  const box = await node.boundingBox();
  if (!box) throw new Error("node bounding box not found");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 });
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
}

export async function dragFromPoint(page: Page, startX: number, startY: number, dx: number, dy: number) {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx / 2, startY + dy / 2, { steps: 5 });
  await page.mouse.move(startX + dx, startY + dy, { steps: 5 });
  await page.mouse.up();
}

export async function dragNodeTo(page: Page, node: Locator, targetX: number, targetY: number) {
  const box = await node.boundingBox();
  if (!box) throw new Error("node bounding box not found");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move((x + targetX) / 2, (y + targetY) / 2, { steps: 5 });
  await page.mouse.move(targetX, targetY, { steps: 5 });
  await page.mouse.up();
}

// Double-clicks the middle of an SVG edge path in screen space. A
// smoothstep edge's bounding-box center is frequently empty space (e.g. an
// L-shaped route), so clicking there lands on the pane instead of the edge;
// this walks the actual path geometry (getPointAtLength) and maps it
// through the SVG's screen transform to get a point genuinely on the line.
export async function dblclickEdgePath(page: Page, selector = ".react-flow__edge-path") {
  const point = await page.evaluate((sel) => {
    const path = document.querySelector(sel) as SVGPathElement;
    const len = path.getTotalLength();
    const pt = path.getPointAtLength(len / 2);
    const ctm = path.getScreenCTM()!;
    return { x: pt.x * ctm.a + pt.y * ctm.c + ctm.e, y: pt.x * ctm.b + pt.y * ctm.d + ctm.f };
  }, selector);
  await page.mouse.dblclick(point.x, point.y);
}

export async function deselectAll(page: Page) {
  await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
}

// Selects every given node by Shift-dragging a marquee box around all of
// them. React Flow's ctrl/cmd-click multi-select relies on a key-press hook
// that races with Playwright's synthetic modifier events and is flaky to
// automate reliably; marquee selection (drag while holding the
// `selectionKeyCode`, Shift by default) is the robust equivalent for tests.
// Wrapped in a retry since a single drag occasionally doesn't register on
// the first attempt.
export async function marqueeSelect(page: Page, nodes: Locator[]) {
  await expect(async () => {
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    const boxes = await Promise.all(nodes.map((n) => n.boundingBox()));
    if (!canvasBox || boxes.some((b) => !b)) throw new Error("missing boxes");
    const valid = boxes as NonNullable<(typeof boxes)[number]>[];

    const startX = Math.max(canvasBox.x + 5, Math.min(...valid.map((b) => b.x)) - 100);
    const startY = Math.max(canvasBox.y + 5, Math.min(...valid.map((b) => b.y)) - 100);
    const endX = Math.max(...valid.map((b) => b.x + b.width)) + 100;
    const endY = Math.max(...valid.map((b) => b.y + b.height)) + 100;

    await page.keyboard.down("Shift");
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 30 });
    await page.mouse.up();
    await page.keyboard.up("Shift");

    for (const node of nodes) {
      await expect(node).toHaveClass(/selected/);
    }
  }).toPass({ timeout: 10000 });
}
