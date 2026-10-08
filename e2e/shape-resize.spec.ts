// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

test.describe("Shape sizing and selection outline", () => {
  test("a newly added shape defaults to a compact size, not the old oversized default", async ({
    diagramPage: page,
  }) => {
    const node = await addWidget(page, "Process");
    // Read the node's own flow-space size (its inline style), not its
    // on-screen boundingBox - that's scaled by the canvas's current zoom
    // level and isn't a reliable proxy for the configured size.
    const width = await node.evaluate((el) => parseInt((el as HTMLElement).style.width, 10));
    const height = await node.evaluate((el) => parseInt((el as HTMLElement).style.height, 10));
    // Was 140x90, 120x70, then 60x35 (too small to read comfortably) - now 90x52.
    expect(width).toBe(90);
    expect(height).toBe(52);
  });

  test("selecting a non-rectangular shape shows resize handles with no rectangular boundary line", async ({
    diagramPage: page,
  }) => {
    const node = await addWidget(page, "Decision");
    await node.click();

    // Resize handles (the 4 corner dots) still show - they're needed to
    // resize - but the connecting boundary lines are hidden, since a plain
    // rectangle drawn around a diamond (or any non-rectangular shape)
    // visually contradicts the shape's own already-correctly-outlined
    // border.
    await expect(page.locator(".react-flow__resize-control.handle")).toHaveCount(4);
    const lines = page.locator(".react-flow__resize-control.line");
    await expect(lines).toHaveCount(4);
    for (const line of await lines.all()) {
      await expect(line).toHaveCSS("opacity", "0");
    }
  });

  test("shape text defaults to 13px and the Actor shape has its default size too", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.dblclick();
    await page.locator(".shape-node-textarea").fill("Hi");
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await expect(node.locator(".shape-node-text")).toHaveCSS("font-size", "13px");

    const actor = await addWidget(page, "Actor / User");
    expect(await actor.evaluate((el) => parseInt((el as HTMLElement).style.width, 10))).toBe(60);
    expect(await actor.evaluate((el) => parseInt((el as HTMLElement).style.height, 10))).toBe(88);
  });

  test("shapes can be resized down to a small minimum", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click();
    const handle = node.locator(".react-flow__resize-control.handle.bottom.right");
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle not found");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 200, box.y - 200, { steps: 8 });
    await page.mouse.up();
    const w = await node.evaluate((el) => parseInt((el as HTMLElement).style.width, 10));
    const h = await node.evaluate((el) => parseInt((el as HTMLElement).style.height, 10));
    expect(w).toBeLessThan(90);
    expect(w).toBeGreaterThanOrEqual(30);
    expect(h).toBeLessThan(52);
    expect(h).toBeGreaterThanOrEqual(24);
  });

  test("shape outlines are thinner than the old 2px border / 3px icon stroke", async ({ diagramPage: page }) => {
    const process = await addWidget(page, "Process");
    const border = await process.locator(".shape-node").evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
    expect(border).toBeLessThan(2);
    expect(border).toBeGreaterThanOrEqual(1);

    const cloud = await addWidget(page, "Cloud");
    const stroke = await cloud.locator(".shape-svg path").first().getAttribute("stroke-width");
    expect(parseFloat(stroke ?? "3")).toBeCloseTo(2.1, 5);
  });
});
