// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragFromPoint, marqueeSelect, settleLayout, spreadNodes } from "./helpers";

test.describe("Object grouping", () => {
  test("Ctrl+G groups 2+ selected nodes into a group container", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await marqueeSelect(page, [a, b]);
    await page.keyboard.press("Control+g");

    await expect(page.locator(".react-flow__node-group")).toHaveCount(1);
  });

  test("dragging a group moves every member with it", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await marqueeSelect(page, [a, b]);
    await page.keyboard.press("Control+g");
    await expect(page.locator(".react-flow__node-group")).toHaveCount(1);

    const boxABefore = await a.boundingBox();
    const boxBBefore = await b.boundingBox();
    if (!boxABefore || !boxBBefore) throw new Error("node not found");

    const group = page.locator(".react-flow__node-group");
    const groupBox = await group.boundingBox();
    if (!groupBox) throw new Error("group not found");
    // The group container has a 20px padding margin around its members, so
    // its top-left area is empty space - grab it there to drag the whole
    // group without dragging a member. Offset well clear of both the
    // group's own edge and its (visible, since just-grouped-and-selected)
    // NodeResizer corner handle, which sits right at the exact corner.
    await dragFromPoint(page, groupBox.x + 15, groupBox.y + 15, 120, 90);
    await page.waitForTimeout(100);

    const boxAAfter = await a.boundingBox();
    const boxBAfter = await b.boundingBox();
    if (!boxAAfter || !boxBAfter) throw new Error("node not found after drag");

    expect(boxAAfter.x).toBeGreaterThan(boxABefore.x + 90);
    expect(boxAAfter.y).toBeGreaterThan(boxABefore.y + 60);
    expect(boxBAfter.x).toBeGreaterThan(boxBBefore.x + 90);
    expect(boxBAfter.y).toBeGreaterThan(boxBBefore.y + 60);
  });

  test("Ctrl+Shift+G ungroups, keeping members at their positions", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await marqueeSelect(page, [a, b]);
    await page.keyboard.press("Control+g");
    await expect(page.locator(".react-flow__node-group")).toHaveCount(1);

    const boxABefore = await a.boundingBox();
    const boxBBefore = await b.boundingBox();
    if (!boxABefore || !boxBBefore) throw new Error("node not found");

    await page.keyboard.press("Control+Shift+g");
    await expect(page.locator(".react-flow__node-group")).toHaveCount(0);

    const boxAAfter = await a.boundingBox();
    const boxBAfter = await b.boundingBox();
    if (!boxAAfter || !boxBAfter) throw new Error("node not found after ungroup");
    expect(Math.abs(boxAAfter.x - boxABefore.x)).toBeLessThan(2);
    expect(Math.abs(boxAAfter.y - boxABefore.y)).toBeLessThan(2);
    expect(Math.abs(boxBAfter.x - boxBBefore.x)).toBeLessThan(2);
    expect(Math.abs(boxBAfter.y - boxBBefore.y)).toBeLessThan(2);
  });

  test("deleting a group cascades to delete its members", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await marqueeSelect(page, [a, b]);
    await page.keyboard.press("Control+g");
    await expect(page.locator(".react-flow__node-group")).toHaveCount(1);

    // The group is already selected right after grouping.
    await page.keyboard.press("Backspace");

    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });
});
