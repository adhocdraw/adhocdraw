// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, deselectAll, dragNodeTo, marqueeSelect, settleLayout, spreadNodes } from "./helpers";

test.describe("Align and distribute", () => {
  test("selecting 2+ nodes shows the align panel; selecting 1 node hides it", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await a.click();
    await expect(page.locator(".align-panel")).toHaveCount(0);

    await marqueeSelect(page, [a, b]);
    await expect(page.locator(".align-panel")).toBeVisible();
  });

  test("align left moves selected nodes to the same left edge", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await marqueeSelect(page, [a, b]);
    await page.locator('.align-panel button[title="Align left"]').click();

    const boxA = await a.boundingBox();
    const boxB = await b.boundingBox();
    if (!boxA || !boxB) throw new Error("node not found");
    expect(Math.abs(boxA.x - boxB.x)).toBeLessThan(2);
  });

  test("align top moves selected nodes to the same top edge", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await marqueeSelect(page, [a, b]);
    await page.locator('.align-panel button[title="Align top"]').click();

    const boxA = await a.boundingBox();
    const boxB = await b.boundingBox();
    if (!boxA || !boxB) throw new Error("node not found");
    expect(Math.abs(boxA.y - boxB.y)).toBeLessThan(2);
  });

  test("distribute horizontally requires 3+ nodes and spaces centers evenly", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await marqueeSelect(page, [a, b]);
    await expect(page.locator('.align-panel button[title="Distribute horizontally"]')).toBeDisabled();
    // Deselect before repositioning individually - a and b are still
    // selected from the marquee above, and dragging a selected node moves
    // every selected node together, which would scramble the intended
    // per-node target positions below.
    await deselectAll(page);

    const c = await addWidget(page, "Process");
    await settleLayout(page);
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    // Spread three nodes unevenly along the x-axis so distribution is a
    // real (non-trivial) change, then verify equal center spacing after.
    // Kept within a margin that leaves room for marqueeSelect's own 100px
    // padding around the nodes' bounding box, so the drag stays on-screen.
    await dragNodeTo(page, a, canvasBox.x + 300, canvasBox.y + canvasBox.height / 2);
    await dragNodeTo(page, b, canvasBox.x + 420, canvasBox.y + canvasBox.height / 2);
    await dragNodeTo(page, c, canvasBox.x + 560, canvasBox.y + canvasBox.height / 2);

    await marqueeSelect(page, [a, b, c]);
    await page.locator('.align-panel button[title="Distribute horizontally"]').click();
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    const boxA = await a.boundingBox();
    const boxB = await b.boundingBox();
    const boxC = await c.boundingBox();
    if (!boxA || !boxB || !boxC) throw new Error("node not found");
    const centerA = boxA.x + boxA.width / 2;
    const centerB = boxB.x + boxB.width / 2;
    const centerC = boxC.x + boxC.width / 2;
    expect(Math.abs(centerB - centerA - (centerC - centerB))).toBeLessThan(2);
  });
});
