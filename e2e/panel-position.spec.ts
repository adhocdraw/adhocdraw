// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, openDiagram } from "./helpers";

async function center(loc: import("@playwright/test").Locator) {
  const b = await loc.boundingBox();
  if (!b) throw new Error("box not found");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
}

async function drag(page: import("@playwright/test").Page, grip: import("@playwright/test").Locator, dx: number, dy: number) {
  const { x, y } = await center(grip);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}

test.describe("Draggable floating panels", () => {
  test("the text style panel can be dragged and keeps its position for the next selection and reload", async ({
    diagramPage: page,
    diagram,
  }) => {
    const node = await addWidget(page, "Process");
    await node.click();
    const panel = page.locator(".style-panel");
    await expect(panel).toBeVisible();
    const start = (await center(panel)).box;

    await drag(page, panel.locator(".panel-grip"), 0, 160);
    const moved = (await center(panel)).box;
    expect(moved.y - start.y).toBeGreaterThan(120);

    // Deselect and reselect: the panel reappears where the user left it.
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await expect(panel).toHaveCount(0);
    await node.click();
    const reselected = (await center(page.locator(".style-panel"))).box;
    expect(Math.abs(reselected.y - moved.y)).toBeLessThan(3);

    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
    await page.reload();
    await page.getByText(diagram.name, { exact: true }).click();
    await page.locator(".react-flow__node").first().click();
    const afterReload = (await center(page.locator(".style-panel"))).box;
    expect(Math.abs(afterReload.y - moved.y)).toBeLessThan(3);
  });

});
