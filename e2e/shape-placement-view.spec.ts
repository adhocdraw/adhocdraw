// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { createDiagramFromMenu, addWidget } from "./helpers";

async function inView(page: import("@playwright/test").Page, node: import("@playwright/test").Locator) {
  const c = (await page.locator(".canvas-flow").boundingBox())!;
  const b = (await node.boundingBox())!;
  return b.x >= c.x - 1 && b.y >= c.y - 1 && b.x + b.width <= c.x + c.width + 1 && b.y + b.height <= c.y + c.height + 1;
}

test.describe("New shapes land in the visible canvas", () => {
  test("on a White Board covered in drawing, a new shape appears in view", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `wb-place-${Date.now()}`, "White Board");
    const c = (await page.locator(".canvas-flow").boundingBox())!;
    // Big scribbles all over the view (their boxes cover the middle of the canvas).
    for (let i = 0; i < 4; i++) {
      await page.mouse.move(c.x + 150, c.y + 100 + i * 80);
      await page.mouse.down();
      await page.mouse.move(c.x + 800, c.y + 140 + i * 90, { steps: 8 });
      await page.mouse.up();
    }
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(4);
    for (const kind of ["Process", "Decision", "Cloud"]) {
      const node = await addWidget(page, kind);
      await expect.poll(() => inView(page, node)).toBe(true);
    }
  });

  test("several shapes added in a row all stay in view, without stacking exactly on each other", async ({ diagramPage: page }) => {
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      const node = await addWidget(page, "Process");
      await expect.poll(() => inView(page, node)).toBe(true);
      const b = (await node.boundingBox())!;
      seen.push(`${Math.round(b.x)},${Math.round(b.y)}`);
    }
    expect(new Set(seen).size).toBeGreaterThan(3);
  });

  test("after panning away from older shapes, a new shape is put where you are looking, not next to the old ones", async ({
    diagramPage: page,
  }) => {
    const first = await addWidget(page, "Process");
    await first.click();
    // Pan the canvas far away from it.
    const c = (await page.locator(".canvas-flow").boundingBox())!;
    await page.mouse.move(c.x + 400, c.y + 300);
    await page.mouse.down({ button: "left" });
    await page.mouse.move(c.x + 400 - 900, c.y + 300, { steps: 6 });
    await page.mouse.up();
    const second = await addWidget(page, "Decision");
    await expect.poll(() => inView(page, second)).toBe(true);
  });

  test("zoomed out, a new shape is sized up so it is not tiny on screen", async ({ diagramPage: page }) => {
    const readZoom = () =>
      page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    // The zoom buttons step through preset levels (100, 90, 80, 75, 67, 50 ...).
    for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Zoom Out" }).click(); // ends at 50%
    await expect.poll(readZoom).toBeLessThan(0.6);
    const node = await addWidget(page, "Process");
    const b = (await node.boundingBox())!;
    // Close to the default 90x52 on screen rather than 90*zoom.
    expect(b.width).toBeGreaterThan(70);
  });
});
