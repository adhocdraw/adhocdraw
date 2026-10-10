// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, deselectAll, readDiagram } from "./helpers";

test.describe("Keyboard shortcuts help panel", () => {
  test("opens via the header button and closes via the close button", async ({ diagramPage: page }) => {
    await expect(page.locator(".shortcuts-panel")).toHaveCount(0);
    await page.getByRole("button", { name: "Shortcuts" }).click();
    await expect(page.locator(".shortcuts-panel")).toBeVisible();
    await expect(page.getByText("Keyboard shortcuts")).toBeVisible();
    await expect(page.locator(".shortcuts-list li")).toHaveCount(26);

    await page.locator(".shortcuts-close").click();
    await expect(page.locator(".shortcuts-panel")).toHaveCount(0);
  });

  test("opens via ? and closes via Escape", async ({ diagramPage: page }) => {
    await deselectAll(page);
    await page.keyboard.press("?");
    await expect(page.locator(".shortcuts-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".shortcuts-panel")).toHaveCount(0);
  });

  test("every shortcut listed actually works: arrow nudge", async ({ diagramPage: page, diagram }) => {
    // Reads the persisted (unrounded) position through the API rather than
    // the DOM transform: at zoom 2 in this headless environment, xyflow's
    // rendered CSS transform pixel gets independently rounded, which can
    // make a full-precision 1px flow-space move look like 0.5px on screen.
    const readSavedPosition = async () => {
      return (await readDiagram(page, diagram.id))!.data.pages[0].nodes[0].position;
    };

    await addWidget(page, "Process");
    const node = page.locator(".react-flow__node").first();
    await node.click();
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
    const before = await readSavedPosition();

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
    const after1px = await readSavedPosition();
    expect(after1px.x - before.x).toBeCloseTo(1, 5);
    expect(after1px.y - before.y).toBeCloseTo(1, 5);

    await page.keyboard.press("Shift+ArrowRight");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
    const after10px = await readSavedPosition();
    expect(after10px.x - after1px.x).toBeCloseTo(10, 5);
  });

  test("Ctrl/Cmd+A selects every node", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await deselectAll(page);
    await page.keyboard.press("Control+a");
    await expect(a).toHaveClass(/selected/);
    await expect(b).toHaveClass(/selected/);
  });

  test("Ctrl/Cmd+= zooms in and Ctrl/Cmd+- zooms out", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    const readZoom = () =>
      page.locator(".react-flow__viewport").evaluate((el) => {
        const m = el.style.transform.match(/scale\(([\d.]+)\)/);
        return m ? Number(m[1]) : null;
      });
    // fitView on a single small node lands at max zoom, so start by zooming
    // out (guaranteed to change something) before testing zoom in.
    const before = await readZoom();
    await page.keyboard.press("Control+-");
    await expect.poll(readZoom).not.toBe(before);
    const afterZoomOut = await readZoom();
    await page.keyboard.press("Control+=");
    await expect.poll(readZoom).not.toBe(afterZoomOut);
  });
});
