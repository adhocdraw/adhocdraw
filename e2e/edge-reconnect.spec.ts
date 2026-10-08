// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, deselectAll, dragHandle, dragNodeTo, settleLayout, spreadNodes } from "./helpers";

// Clicks a point genuinely on the edge's path (its bounding-box center can be
// empty space), so the edge reliably becomes selected.
async function selectEdge(page: import("@playwright/test").Page) {
  const point = await page.evaluate(() => {
    const path = document.querySelector(".react-flow__edge-path") as SVGPathElement;
    const pt = path.getPointAtLength(path.getTotalLength() / 2);
    const ctm = path.getScreenCTM()!;
    return { x: pt.x * ctm.a + pt.y * ctm.c + ctm.e, y: pt.x * ctm.b + pt.y * ctm.d + ctm.f };
  });
  await page.mouse.click(point.x, point.y);
}

test.describe("Edge reconnect", () => {
  test("dragging a selected edge's end dot to another shape re-attaches that end", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    const c = await addWidget(page, "Ellipse");
    await settleLayout(page);
    // Park the third shape at the top first, before spreading the other two
    // to the sides, so none of them overlap when grabbed.
    const canvas = await page.locator(".canvas-flow").boundingBox();
    if (!canvas) throw new Error("canvas not found");
    await dragNodeTo(page, c, canvas.x + canvas.width / 2, canvas.y + 90);
    await spreadNodes(page, [a, b]);
    await page.waitForTimeout(100);
    await deselectAll(page);

    await dragHandle(page, a, "right", b, "left");
    const idA = await a.getAttribute("data-id");
    const idB = await b.getAttribute("data-id");
    const idC = await c.getAttribute("data-id");
    const edge = page.locator(".react-flow__edge");
    await expect(edge).toHaveAttribute("data-id", new RegExp(`${idA}right-.*${idB}left`));

    await selectEdge(page);
    await expect(edge).toHaveClass(/selected/);

    const dot = edge.locator(".react-flow__edgeupdater-target");
    const dotBox = await dot.boundingBox();
    const cHandle = await c.locator('[data-handlepos="bottom"]').boundingBox();
    if (!dotBox || !cHandle) throw new Error("dot or handle not found");
    await page.mouse.move(dotBox.x + dotBox.width / 2 - 9, dotBox.y + dotBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cHandle.x + cHandle.width / 2, cHandle.y + cHandle.height / 2, { steps: 15 });
    await page.mouse.up();

    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.locator(".react-flow__edge")).toHaveAttribute(
      "data-id",
      new RegExp(`${idA}right-.*${idC}bottom`)
    );
  });

  test("the start end of an edge can be moved to another shape too", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    const c = await addWidget(page, "Ellipse");
    await settleLayout(page);
    // Park the third shape at the top first, before spreading the other two
    // to the sides, so none of them overlap when grabbed.
    const canvas = await page.locator(".canvas-flow").boundingBox();
    if (!canvas) throw new Error("canvas not found");
    await dragNodeTo(page, c, canvas.x + canvas.width / 2, canvas.y + 90);
    await spreadNodes(page, [a, b]);
    await page.waitForTimeout(100);
    await deselectAll(page);

    await dragHandle(page, a, "right", b, "left");
    const idB = await b.getAttribute("data-id");
    const idC = await c.getAttribute("data-id");
    const edge = page.locator(".react-flow__edge");
    await selectEdge(page);
    await expect(edge).toHaveClass(/selected/);

    const dot = edge.locator(".react-flow__edgeupdater-source");
    const dotBox = await dot.boundingBox();
    const cHandle = await c.locator('[data-handlepos="bottom"]').boundingBox();
    if (!dotBox || !cHandle) throw new Error("dot or handle not found");
    // The anchor sits right on top of the node's own handle; grab its ring
    // just outside the handle so the drag starts the reconnect.
    await page.mouse.move(dotBox.x + dotBox.width / 2 + 9, dotBox.y + dotBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cHandle.x + cHandle.width / 2, cHandle.y + cHandle.height / 2, { steps: 15 });
    await page.mouse.up();

    await expect(page.locator(".react-flow__edge")).toHaveAttribute(
      "data-id",
      new RegExp(`${idC}bottom-.*${idB}left`)
    );
  });
});
