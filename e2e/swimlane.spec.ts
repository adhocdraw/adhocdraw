// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragNodeTo, settleLayout } from "./helpers";

test.describe("Swimlane container", () => {
  test("adding a swimlane creates two default lanes", async ({ diagramPage: page }) => {
    await addWidget(page, "Swimlane");
    await expect(page.locator(".swimlane-lane")).toHaveCount(2);
    await expect(page.locator(".swimlane-lane-header span")).toHaveText(["Lane 1", "Lane 2"]);
  });

  test("double-clicking a lane header renames it", async ({ diagramPage: page }) => {
    await addWidget(page, "Swimlane");
    // The selected node's floating style panel can sit on top of its own
    // header near the top of the canvas and swallow a real mouse
    // double-click, so dispatch the event straight to the header instead.
    const header = page.locator(".swimlane-lane-header").first();
    await header.locator("span").first().dispatchEvent("dblclick");
    await page.locator(".swimlane-lane-header input").fill("Design");
    await page.keyboard.press("Enter");
    await expect(page.locator(".swimlane-lane-header").first()).toContainText("Design");
  });

  test("+ Lane adds a lane and its x button removes one", async ({ diagramPage: page }) => {
    await addWidget(page, "Swimlane");
    await expect(page.locator(".swimlane-lane")).toHaveCount(2);

    await page.locator(".swimlane-add-lane").click();
    await expect(page.locator(".swimlane-lane")).toHaveCount(3);

    await page.locator(".swimlane-lane-remove").first().click();
    await expect(page.locator(".swimlane-lane")).toHaveCount(2);
  });

  test("dragging the divider resizes the adjacent lanes", async ({ diagramPage: page }) => {
    await addWidget(page, "Swimlane");
    const divider = page.locator(".swimlane-divider").first();
    const dividerBox = await divider.boundingBox();
    if (!dividerBox) throw new Error("divider not found");

    const lanes = page.locator(".swimlane-lane");
    const firstWidthBefore = (await lanes.nth(0).boundingBox())!.width;

    const x = dividerBox.x + dividerBox.width / 2;
    const y = dividerBox.y + dividerBox.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 80, y, { steps: 5 });
    await page.mouse.up();

    const firstWidthAfter = (await lanes.nth(0).boundingBox())!.width;
    expect(firstWidthAfter).toBeLessThan(firstWidthBefore - 30);
  });

  test("a node dropped fully inside the swimlane becomes its child", async ({ diagramPage: page }) => {
    const swimlane = await addWidget(page, "Swimlane");
    const child = await addWidget(page, "Process");
    await settleLayout(page);

    const swimlaneBox = await swimlane.boundingBox();
    if (!swimlaneBox) throw new Error("swimlane not found");
    await dragNodeTo(page, child, swimlaneBox.x + swimlaneBox.width / 2, swimlaneBox.y + swimlaneBox.height / 2);

    // Dragging the swimlane should carry its now-parented child with it.
    const childBoxBefore = await child.boundingBox();
    if (!childBoxBefore) throw new Error("child not found");
    await page.mouse.move(swimlaneBox.x + 10, swimlaneBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(swimlaneBox.x + 110, swimlaneBox.y + 90, { steps: 5 });
    await page.mouse.up();

    const childBoxAfter = await child.boundingBox();
    if (!childBoxAfter) throw new Error("child not found after drag");
    expect(childBoxAfter.x).toBeGreaterThan(childBoxBefore.x + 70);
    expect(childBoxAfter.y).toBeGreaterThan(childBoxBefore.y + 50);
  });

  test("auto-resize toggle grows the swimlane to keep a repositioned child inside", async ({ diagramPage: page }) => {
    // Snap to grid is on by default; this test positions the child to the pixel.
    await page.getByRole("checkbox", { name: "Snap to grid" }).uncheck();
    const swimlane = await addWidget(page, "Swimlane");
    const child = await addWidget(page, "Process");
    await settleLayout(page);

    let swimlaneBox = await swimlane.boundingBox();
    if (!swimlaneBox) throw new Error("swimlane not found");
    await dragNodeTo(page, child, swimlaneBox.x + swimlaneBox.width / 2, swimlaneBox.y + swimlaneBox.height / 2);

    await swimlane.click({ position: { x: 5, y: 5 } });
    // The selected node's floating style panel can sit over this button, so
    // dispatch the click straight to it.
    await page.locator(".swimlane-auto-resize").dispatchEvent("click");
    await expect(page.locator(".swimlane-auto-resize")).toHaveClass(/active/);

    swimlaneBox = await swimlane.boundingBox();
    if (!swimlaneBox) throw new Error("swimlane not found");
    const heightBefore = swimlaneBox.height;

    // Drag the child near the swimlane's bottom edge, still fully inside
    // (dragNodeTo targets the node's center, so offset by half its height
    // plus a small margin to keep the whole node within the bounds).
    const childHeight = (await child.boundingBox())!.height;
    await dragNodeTo(
      page,
      child,
      swimlaneBox.x + swimlaneBox.width / 2,
      swimlaneBox.y + swimlaneBox.height - childHeight / 2 - 10
    );

    const heightAfter = (await swimlane.boundingBox())!.height;
    expect(heightAfter).toBeGreaterThan(heightBefore);
  });
});
