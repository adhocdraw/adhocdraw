// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragHandle, settleLayout, spreadNodes, openShapesPanel } from "./helpers";

test.describe("Adding shapes from the Shapes flyout", () => {
  test("a single click only highlights a shape; double-click adds it", async ({ diagramPage: page }) => {
    await openShapesPanel(page);
    const processBtn = page.locator(".shapes-panel").getByRole("button", { name: "Process" });
    await processBtn.click();
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await processBtn.dblclick();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });

  test("with nothing interacted with yet, the first shape lands near the center of the canvas", async ({
    diagramPage: page,
  }) => {
    const node = await addWidget(page, "Process");
    const canvas = await page.locator(".canvas-flow").boundingBox();
    const box = await node.boundingBox();
    if (!canvas || !box) throw new Error("boxes not found");
    expect(Math.abs(box.x + box.width / 2 - (canvas.x + canvas.width / 2))).toBeLessThan(60);
    expect(Math.abs(box.y + box.height / 2 - (canvas.y + canvas.height / 2))).toBeLessThan(60);
  });

  test("a new shape is placed just to the right of the last shape that was clicked", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await a.click();
    const aBox = await a.boundingBox();
    const c = await addWidget(page, "Ellipse");
    const cBox = await c.boundingBox();
    if (!aBox || !cBox) throw new Error("boxes not found");
    expect(cBox.x).toBeGreaterThan(aBox.x + aBox.width);
    expect(Math.abs(cBox.x - (aBox.x + aBox.width))).toBeLessThan(aBox.width + 120);
  });

  test("a new shape does not land on top of an existing one", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    const aBox = await a.boundingBox();
    const bBox = await b.boundingBox();
    if (!aBox || !bBox) throw new Error("boxes not found");
    const overlap =
      aBox.x < bBox.x + bBox.width && aBox.x + aBox.width > bBox.x && aBox.y < bBox.y + bBox.height && aBox.y + aBox.height > bBox.y;
    expect(overlap).toBe(false);
  });

  test("after clicking an arrow, a new shape appears near that arrow", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await dragHandle(page, a, "right", b, "left");
    const point = await page.evaluate(() => {
      const path = document.querySelector(".react-flow__edge-path") as SVGPathElement;
      const pt = path.getPointAtLength(path.getTotalLength() / 2);
      const ctm = path.getScreenCTM()!;
      return { x: pt.x * ctm.a + pt.y * ctm.c + ctm.e, y: pt.x * ctm.b + pt.y * ctm.d + ctm.f };
    });
    await page.mouse.click(point.x, point.y);
    const c = await addWidget(page, "Ellipse");
    const cBox = await c.boundingBox();
    if (!cBox) throw new Error("box not found");
    expect(Math.abs(cBox.x + cBox.width / 2 - point.x)).toBeLessThan(150);
  });
});
