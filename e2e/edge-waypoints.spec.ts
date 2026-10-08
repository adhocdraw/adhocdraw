// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragHandle, openDiagram, settleLayout, spreadNodes } from "./helpers";

// Selects the edge, then pulls its midpoint dot to add a bend point.
async function addWaypointByDrag(page: import("@playwright/test").Page, dx = 0, dy = -60) {
  const point = await page.evaluate(() => {
    const path = document.querySelector(".react-flow__edge-path") as SVGPathElement;
    const pt = path.getPointAtLength(path.getTotalLength() / 2);
    const ctm = path.getScreenCTM()!;
    return { x: pt.x * ctm.a + pt.y * ctm.c + ctm.e, y: pt.x * ctm.b + pt.y * ctm.d + ctm.f };
  });
  await page.mouse.click(point.x, point.y);
  const dot = page.locator(".edge-midpoint").first();
  await expect(dot).toBeVisible();
  const box = await dot.boundingBox();
  if (!box) throw new Error("midpoint dot not found");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}

test.describe("Edge waypoints", () => {
  test("dragging the midpoint dot of a selected edge adds a waypoint that reroutes the edge", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await dragHandle(page, a, "right", b, "left");

    await addWaypointByDrag(page);
    await expect(page.locator(".edge-waypoint")).toHaveCount(1);
  });

  test("dragging a waypoint moves it, and double-clicking it removes it", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await dragHandle(page, a, "right", b, "left");

    await addWaypointByDrag(page);
    await expect(page.locator(".edge-waypoint")).toHaveCount(1);

    const waypoint = page.locator(".edge-waypoint");
    const wpBox = await waypoint.boundingBox();
    if (!wpBox) throw new Error("waypoint not found");
    const startX = wpBox.x + wpBox.width / 2;
    const startY = wpBox.y + wpBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 40, startY - 40, { steps: 5 });
    await page.mouse.up();

    const movedBox = await waypoint.boundingBox();
    if (!movedBox) throw new Error("waypoint not found after drag");
    expect(Math.abs(movedBox.x - wpBox.x)).toBeGreaterThan(10);

    await waypoint.dblclick();
    await expect(page.locator(".edge-waypoint")).toHaveCount(0);
  });

  test("waypoints persist through autosave/reload", async ({ diagramPage: page, diagram }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await dragHandle(page, a, "right", b, "left");

    await addWaypointByDrag(page);
    await expect(page.locator(".edge-waypoint")).toHaveCount(1);
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await expect(page.locator(".edge-waypoint")).toHaveCount(1);
  });
});
