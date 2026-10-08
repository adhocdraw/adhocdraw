// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragFromPoint, dragNodeTo, settleLayout, spreadNodes } from "./helpers";

// Child is dropped in the frame's top-left quadrant so the frame's
// bottom-right quadrant stays empty - that's where we grab the frame itself
// to drag it, avoiding an accidental drag of the child sitting on top of it.
async function dropChildInFrameTopLeft(page: import("@playwright/test").Page, frame: import("@playwright/test").Locator, child: import("@playwright/test").Locator) {
  const frameBox = await frame.boundingBox();
  if (!frameBox) throw new Error("frame not found");
  await dragNodeTo(page, child, frameBox.x + frameBox.width * 0.3, frameBox.y + frameBox.height * 0.3);
  return frameBox;
}

test.describe("Functional frames", () => {
  test("dragging a frame moves a node parented inside it", async ({ diagramPage: page }) => {
    const frame = await addWidget(page, "Frame");
    const child = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [frame, child]);
    const frameBox = await dropChildInFrameTopLeft(page, frame, child);

    const childBoxBefore = await child.boundingBox();
    if (!childBoxBefore) throw new Error("child not found");

    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await dragFromPoint(page, frameBox.x + frameBox.width * 0.85, frameBox.y + frameBox.height * 0.85, 120, 80);
    await page.waitForTimeout(100);

    const childBoxAfter = await child.boundingBox();
    if (!childBoxAfter) throw new Error("child not found after drag");

    expect(childBoxAfter.x).toBeGreaterThan(childBoxBefore.x + 90);
    expect(childBoxAfter.y).toBeGreaterThan(childBoxBefore.y + 50);
  });

  test("dragging a node out of a frame unparents it", async ({ diagramPage: page }) => {
    const frame = await addWidget(page, "Frame");
    const child = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [frame, child]);
    const frameBox = await dropChildInFrameTopLeft(page, frame, child);

    // Drag the child well outside the frame's bounds, but keep the drop point
    // inside the visible canvas: a drop beyond the edge auto-pans the view,
    // which moves the frame and makes any position computed earlier stale.
    await dragNodeTo(page, child, frameBox.x + frameBox.width + 250, frameBox.y + frameBox.height * 0.3);

    const childBoxBefore = await child.boundingBox();
    if (!childBoxBefore) throw new Error("child not found");

    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    const frameNow = await frame.boundingBox();
    if (!frameNow) throw new Error("frame not found");
    await dragFromPoint(page, frameNow.x + frameNow.width * 0.85, frameNow.y + frameNow.height * 0.85, 100, 100);
    await page.waitForTimeout(100);

    const childBoxAfter = await child.boundingBox();
    if (!childBoxAfter) throw new Error("child not found after frame drag");

    expect(Math.abs(childBoxAfter.x - childBoxBefore.x)).toBeLessThan(5);
    expect(Math.abs(childBoxAfter.y - childBoxBefore.y)).toBeLessThan(5);
  });

  test("deleting a frame keeps its children", async ({ diagramPage: page }) => {
    const frame = await addWidget(page, "Frame");
    const child = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [frame, child]);
    const frameBox = await dropChildInFrameTopLeft(page, frame, child);

    // Select the frame from its empty bottom-right quadrant, away from the child.
    await frame.locator(".frame-node").click({
      position: { x: frameBox.width * 0.85, y: frameBox.height * 0.85 },
    });
    await expect(frame).toHaveClass(/selected/);
    await page.keyboard.press("Backspace");

    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(page.locator(".shape-node")).toHaveCount(1);
  });
});
