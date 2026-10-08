// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragNodeTo, settleLayout, readDiagram } from "./helpers";

const GRID_SIZE = 16;

test.describe("Snap-to-grid and alignment guides", () => {
  test("snap to grid is on by default, and a dragged node lands on the grid without touching the checkbox", async ({
    diagramPage: page,
    diagram,
  }) => {
    await expect(page.getByRole("checkbox", { name: "Snap to grid" })).toBeChecked();
    const node = await addWidget(page, "Process");
    await settleLayout(page);
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    await dragNodeTo(page, node, canvasBox.x + 231, canvasBox.y + 187);
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
    const saved = (await readDiagram(page, diagram.id))!.data.pages[0].nodes[0].position;
    expect(saved.x % GRID_SIZE).toBe(0);
    expect(saved.y % GRID_SIZE).toBe(0);
  });

  test("enabling snap to grid rounds a dragged node's position to the nearest grid unit", async ({
    diagramPage: page,
    diagram,
  }) => {
    const node = await addWidget(page, "Process");
    await settleLayout(page);
    await page.getByRole("checkbox", { name: "Snap to grid" }).check();

    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    await dragNodeTo(page, node, canvasBox.x + 231, canvasBox.y + 187);

    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
    const saved = (await readDiagram(page, diagram.id))!.data.pages[0].nodes[0].position;
    expect(saved.x % GRID_SIZE).toBe(0);
    expect(saved.y % GRID_SIZE).toBe(0);
  });

  test("alignment guides appear while dragging a node into alignment with another, and disappear on drop", async ({
    diagramPage: page,
  }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);

    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    await dragNodeTo(page, a, canvasBox.x + 150, canvasBox.y + 150);
    await dragNodeTo(page, b, canvasBox.x + 450, canvasBox.y + 350);

    await expect(page.locator(".guide-line")).toHaveCount(0);

    const aBox = await a.boundingBox();
    const bBox = await b.boundingBox();
    if (!aBox || !bBox) throw new Error("node not found");
    const startX = aBox.x + aBox.width / 2;
    const startY = aBox.y + aBox.height / 2;
    const targetY = bBox.y + bBox.height / 2;

    // Retries internally like the other drag helpers: an in-progress mouse
    // move occasionally doesn't register in headless automation on the first
    // attempt, so release the button and retry from a clean state if no
    // guide shows up yet.
    await expect(async () => {
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX, targetY, { steps: 10 });
      // The node trails the pointer slightly, so sweep a little around the
      // target (as a hand would) until it lines up with the other shape.
      for (let dy = -30; dy <= 30; dy += 3) {
        await page.mouse.move(startX, targetY + dy);
        if ((await page.locator(".guide-line").count()) > 0) break;
      }
      const count = await page.locator(".guide-line").count();
      if (count === 0) {
        await page.mouse.up();
        throw new Error("no alignment guide appeared during drag");
      }
    }).toPass({ timeout: 10000 });

    await page.mouse.up();
    await expect(page.locator(".guide-line")).toHaveCount(0);
  });
});
