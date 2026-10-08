// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragNodeTo } from "./helpers";

// Regression coverage for T1 (pending_tech_debt.md): the context menu, link
// popover, comment popover, and data panel now use @floating-ui/react
// instead of hand-computed `node.position * zoom + viewport.x/y` math. The
// main behavior to protect is the thing the old code couldn't do at all:
// staying fully on-screen when opened near a canvas edge.
test.describe("Floating UI positioning", () => {
  test("context menu near the bottom edge flips upward, staying fully on-screen", async ({
    diagramPage: page,
  }) => {
    const node = await addWidget(page, "Process");
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    // Drag the node near the bottom of the viewport, where the menu (taller
    // than the remaining space below) would overflow if opened downward.
    await dragNodeTo(page, node, canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height - 40);

    await node.click({ button: "right" });
    const menu = page.locator(".context-menu");
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    const viewportSize = page.viewportSize();
    if (!menuBox || !viewportSize) throw new Error("menu or viewport not found");
    expect(menuBox.y).toBeGreaterThanOrEqual(0);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewportSize.height);
  });

  test("context menu near the right edge shifts left, staying fully on-screen", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    await dragNodeTo(page, node, canvasBox.x + canvasBox.width - 40, canvasBox.y + canvasBox.height / 2);

    await node.click({ button: "right" });
    const menu = page.locator(".context-menu");
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    const viewportSize = page.viewportSize();
    if (!menuBox || !viewportSize) throw new Error("menu or viewport not found");
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewportSize.width);
  });

  test("comment popover stays anchored to its node after the node is dragged", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Add Note" }).click();
    await page.locator(".comment-popover textarea").fill("Anchor test");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

    await dragNodeTo(page, node, 300, 200);

    const nodeBox = await node.boundingBox();
    await page.locator(".comment-badge").click();
    const popoverBox = await page.locator(".comment-popover").boundingBox();
    if (!nodeBox || !popoverBox) throw new Error("node or popover not found");
    // The popover should be positioned right next to the node's new
    // location, not left behind at its pre-drag position.
    expect(Math.abs(popoverBox.y - nodeBox.y)).toBeLessThan(60);
    expect(popoverBox.x).toBeGreaterThan(nodeBox.x);
  });
});
