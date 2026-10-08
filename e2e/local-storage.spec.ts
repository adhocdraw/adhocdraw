// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { addWidget, createDiagramFromMenu, mockFileSystemAccess } from "../e2e/helpers";

// Runs against the hosted, server-less build (client `build:static`): there is
// no API and no database - everything must work from the browser alone.

const ORIGIN = "http://localhost:4173";

test.beforeEach(async ({ page }) => {
  // Leaving the page with work that is not in a file asks for confirmation;
  // accept it so reloads in tests go through.
  page.on("dialog", (d) => d.accept());
  // Start every test with the Shapes panel closed (it floats over the canvas).
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem("e2e.seeded")) {
        localStorage.setItem("e2e.seeded", "1");
        localStorage.setItem("adhocdraw.shapesPanel", JSON.stringify({ open: false, collapsed: false }));
      }
    } catch {
      // storage unavailable
    }
  });
});

async function createDiagram(page: Page, name: string) {
  await page.goto("/");
  await createDiagramFromMenu(page, name);
}

test.describe("Hosted build: everything stays in the browser", () => {
  test("makes no network requests to anything but its own static files", async ({ page }) => {
    const external: string[] = [];
    const api: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url.startsWith("blob:")) return;
      if (!url.startsWith(ORIGIN)) external.push(url);
      if (new URL(url).pathname.startsWith("/api") || new URL(url).pathname.startsWith("/uploads")) api.push(url);
    });
    const name = `static-${Date.now()}`;
    await createDiagram(page, name);
    await addWidget(page, "Process");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
    await page.getByRole("button", { name: /^Export/ }).click();
    await page.getByRole("button", { name: "Export PNG" }).click();
    expect(external).toEqual([]);
    expect(api).toEqual([]);
  });

  test("a new diagram and its shapes survive a reload (saved in the browser)", async ({ page }) => {
    const name = `static-persist-${Date.now()}`;
    await createDiagram(page, name);
    await addWidget(page, "Process");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await page.reload();
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(name);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(page.locator(".diagram-tab.active")).toContainText(name);
  });

  test("diagrams are listed as tabs and can be deleted", async ({ page }) => {
    const a = `static-a-${Date.now()}`;
    const b = `static-b-${Date.now()}`;
    await createDiagram(page, a);
    await createDiagramFromMenu(page, b);
    await expect(page.getByText(a, { exact: true })).toBeVisible();

    await page.getByText(a, { exact: true }).click();
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(a);

    // b is empty, so closing it loses nothing and asks no questions.
    await page.getByRole("button", { name: `Close ${b}` }).click();
    await expect(page.getByText(b, { exact: true })).toHaveCount(0);
  });

  test("version history saves and lists snapshots without a server", async ({ page }) => {
    await createDiagram(page, `static-versions-${Date.now()}`);
    await addWidget(page, "Process");
    await page.getByRole("button", { name: "History" }).click();
    await page.getByRole("button", { name: /Save version/i }).click();
    await expect(page.locator(".version-list li")).toHaveCount(1);
  });

  test("Ctrl/Cmd+S writes the diagram to the user's own file", async ({ page }) => {
    await mockFileSystemAccess(page);
    const name = `static-file-${Date.now()}`;
    await createDiagram(page, name);
    await addWidget(page, "Process");
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("ControlOrMeta+s");
    await page.waitForFunction(() => Boolean((window as unknown as { __lastSavedFile?: unknown }).__lastSavedFile));
    const saved = await page.evaluate(
      () => (window as unknown as { __lastSavedFile: { name: string; content: string } }).__lastSavedFile
    );
    const parsed = JSON.parse(saved.content);
    expect(parsed.name).toBe(name);
    expect(parsed.data.pages[0].nodes).toHaveLength(1);
  });

  test("uploaded images are embedded in the diagram as data, not sent anywhere", async ({ page }) => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#f00"/></svg>'
    );
    await createDiagram(page, `static-img-${Date.now()}`);
    await page.locator(".shapes-toggle").click();
    await page.setInputFiles(".custom-shape-input", { name: "square.svg", mimeType: "image/svg+xml", buffer: svg });
    const shape = page.locator(".shape-btn", { hasText: "square" });
    await expect(shape).toBeVisible();
    await expect(shape.locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
    await shape.dblclick();
    await expect(page.locator(".react-flow__node-image img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
  });

  test("closing an empty diagram needs no confirmation", async ({ page }) => {
    const name = `static-empty-${Date.now()}`;
    await createDiagram(page, name);
    await page.getByRole("button", { name: `Close ${name}` }).click();
    await expect(page.locator(".confirm-dialog")).toHaveCount(0);
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });

  test("closing a diagram with work that was never saved to a file asks first", async ({ page }) => {
    const name = `static-unsaved-${Date.now()}`;
    await createDiagram(page, name);
    await addWidget(page, "Process");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
    await page.getByRole("button", { name: `Close ${name}` }).click();
    const dialog = page.locator(".confirm-dialog");
    await expect(dialog).toContainText("aren't saved to a file");
    await page.getByRole("button", { name: "Close anyway" }).click();
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });

  test("after saving to a file, closing needs no warning - until it changes again", async ({ page }) => {
    await mockFileSystemAccess(page);
    const name = `static-saved-${Date.now()}`;
    await createDiagram(page, name);
    await addWidget(page, "Process");
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("ControlOrMeta+s");
    await page.waitForFunction(() => Boolean((window as unknown as { __lastSavedFile?: unknown }).__lastSavedFile));
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    // Change something after the save: now closing would lose it.
    await addWidget(page, "Decision");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
    await page.getByRole("button", { name: `Close ${name}` }).click();
    await expect(page.locator(".confirm-dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Save again, then close silently.
    await page.keyboard.press("ControlOrMeta+s");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: `Close ${name}` }).click();
    await expect(page.locator(".confirm-dialog")).toHaveCount(0);
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });

  test("a diagram opened from a file closes without a warning if untouched", async ({ page }) => {
    await mockFileSystemAccess(page);
    const name = `static-opened-${Date.now()}`;
    await page.goto("/");
    const payload = {
      name,
      data: {
        pages: [
          {
            id: "p1",
            name: "Page 1",
            nodes: [
              {
                id: "n1",
                type: "shape",
                position: { x: 100, y: 100 },
                data: { shape: "rectangle", text: "hello" },
                style: { width: 120, height: 70 },
              },
            ],
            edges: [],
          },
        ],
      },
    };
    await page.evaluate((p) => {
      (window as unknown as { __mockOpenFile: { name: string; content: string } }).__mockOpenFile = {
        name: "diagram.json",
        content: JSON.stringify(p),
      };
    }, payload);
    await page.getByRole("button", { name: "Open from file" }).click();
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(name);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await page.waitForTimeout(1200); // let any load-time autosave settle

    await page.getByRole("button", { name: `Close ${name}` }).click();
    await expect(page.locator(".confirm-dialog")).toHaveCount(0);
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });

  test("a diagram renamed from its tab keeps the new name after a reload", async ({ page }) => {
    const name = `static-rename-${Date.now()}`;
    await createDiagram(page, name);
    await page.locator(".diagram-tab.active .diagram-tab-name").dblclick();
    const input = page.getByRole("textbox", { name: `Rename ${name}` });
    await input.fill(`${name}-new`);
    await input.press("Enter");
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(`${name}-new`);
    // Wait until the new name has actually been written to the browser's storage.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              new Promise<string[]>((resolve) => {
                const r = indexedDB.open("adhocdraw");
                r.onsuccess = () => {
                  const q = r.result.transaction("diagrams").objectStore("diagrams").getAll();
                  q.onsuccess = () => resolve(q.result.map((d: { name: string }) => d.name));
                };
              })
          ),
        { timeout: 8000 }
      )
      .toContain(`${name}-new`);
    await page.reload();
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(`${name}-new`);
  });

  test.describe("not-saved-to-file indicators", () => {
    const beforeUnloadBlocked = (page: Page) =>
      page.evaluate(() => {
        const e = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      });

    test("an empty diagram has no marks", async ({ page }) => {
      await createDiagram(page, `static-ind-empty-${Date.now()}`);
      await expect(page.locator(".diagram-tab-unsaved")).toHaveCount(0);
      await expect(page.locator(".save-file-btn")).not.toHaveClass(/needs-save/);
      expect(await beforeUnloadBlocked(page)).toBe(false);
    });

    test("work that is not in a file is flagged on the tab, the Save button and the status, until saved", async ({
      page,
    }) => {
      await mockFileSystemAccess(page);
      await createDiagram(page, `static-ind-${Date.now()}`);
      await addWidget(page, "Process");

      const tabDot = page.locator(".diagram-tab.active .diagram-tab-unsaved");
      await expect(tabDot).toBeVisible({ timeout: 8000 });
      await expect(tabDot).toHaveAttribute("title", /Not saved to a file/);
      await expect(page.locator(".save-file-btn")).toHaveClass(/needs-save/);
      await expect(page.locator(".save-status")).toHaveText("Saved in this browser · not saved to a file", {
        timeout: 8000,
      });
      expect(await beforeUnloadBlocked(page)).toBe(true);

      await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
      await page.keyboard.press("ControlOrMeta+s");
      await expect(tabDot).toHaveCount(0, { timeout: 8000 });
      await expect(page.locator(".save-file-btn")).not.toHaveClass(/needs-save/);
      await expect(page.locator(".save-status")).toHaveText(/^Saved/);
      expect(await beforeUnloadBlocked(page)).toBe(false);

      // Editing again brings the marks back.
      await addWidget(page, "Decision");
      await expect(tabDot).toBeVisible({ timeout: 8000 });
    });

    test("the not-saved-to-a-file status sits in its own slot at the right end of the tab pane (both themes)", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1500, height: 800 });
      await mockFileSystemAccess(page);
      await createDiagram(page, `static-ind-slot-${Date.now()}`);
      await addWidget(page, "Process");

      for (const palette of [false, true]) {
        if (palette) await page.getByRole("button", { name: "Theme: Classic" }).click();
        const status = page.locator(".save-status");
        await expect(status).toHaveClass(/save-status-file/, { timeout: 8000 });
        // Full wording stays available (tooltip + page text); the visible label is a short two-liner.
        await expect(status).toHaveAttribute("title", /not saved to a file/);
        // Two lines: "Saved in browser" in green over "Not saved to a file" in red.
        const line = (pseudo: "::before" | "::after") =>
          status.evaluate(
            (el, ps) => {
              const c = getComputedStyle(el, ps);
              const m = c.color.match(/\d+/g)!.map(Number);
              return { text: c.content.replace(/"/g, ""), r: m[0], g: m[1], b: m[2] };
            },
            pseudo
          );
        const first = await line("::before");
        const second = await line("::after");
        expect(first.text).toBe("Saved in browser");
        expect(first.g).toBeGreaterThan(first.r); // green
        expect(first.g).toBeGreaterThan(first.b);
        expect(second.text).toBe("Not saved to a file");
        expect(second.r).toBeGreaterThan(second.g + 40); // red
        expect(second.r).toBeGreaterThan(second.b + 40);

        const slot = await page.locator(".diagram-tabs-status").boundingBox();
        const tabs = await page.locator(".diagram-tabs").boundingBox();
        const header = await page.locator(".canvas-header").boundingBox();
        const sb = await status.boundingBox();
        if (!slot || !tabs || !header || !sb) throw new Error("missing box");
        // Right end of the tab pane, below the toolbar, not overlapping the tab strip.
        expect(slot.y).toBeGreaterThanOrEqual(header.y + header.height - 2);
        expect(slot.x).toBeGreaterThanOrEqual(tabs.x + tabs.width - 2);
        expect(sb.x).toBeGreaterThanOrEqual(slot.x);
        expect(sb.x - slot.x).toBeLessThan(30); // left-aligned in its slot
        expect(sb.x + sb.width).toBeLessThanOrEqual(slot.x + slot.width + 1);
      }
    });

    test("a diagram opened from a file starts without marks", async ({ page }) => {
      await mockFileSystemAccess(page);
      await page.goto("/");
      await page.evaluate(() => {
        (window as unknown as { __mockOpenFile: { name: string; content: string } }).__mockOpenFile = {
          name: "d.json",
          content: JSON.stringify({
            name: "from-file",
            data: {
              pages: [
                {
                  id: "p1",
                  name: "Page 1",
                  nodes: [
                    { id: "n1", type: "shape", position: { x: 50, y: 50 }, data: { shape: "rectangle", text: "x" }, style: { width: 60, height: 35 } },
                  ],
                  edges: [],
                },
              ],
            },
          }),
        };
      });
      await page.getByRole("button", { name: "Open from file" }).click();
      await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText("from-file");
      await page.waitForTimeout(1500);
      await expect(page.locator(".diagram-tab-unsaved")).toHaveCount(0);
      await expect(page.locator(".save-file-btn")).not.toHaveClass(/needs-save/);
    });

    test("after a long time with unsaved work the Save button gets one extra pulse", async ({ page }) => {
      await page.clock.install();
      await createDiagram(page, `static-nudge-${Date.now()}`);
      await addWidget(page, "Process");
      await expect(page.locator(".save-file-btn")).toHaveClass(/needs-save/, { timeout: 8000 });
      await expect(page.locator(".save-file-btn")).not.toHaveClass(/nudge/);
      await page.clock.fastForward("05:10");
      await expect(page.locator(".save-file-btn")).toHaveClass(/nudge/);
    });
  });
});
