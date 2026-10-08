// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, deselectAll, dragHandle, marqueeSelect, settleLayout, spreadNodes } from "./helpers";

test.describe("Right-click context menu", () => {
  test("right-clicking a node opens a menu with all node actions", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    const menu = page.locator(".context-menu");
    await expect(menu).toBeVisible();
    for (const label of ["Duplicate", "Delete", "Bring to Front", "Send to Back", "Copy Style", "Paste Style"]) {
      await expect(menu.getByRole("menuitem", { name: label })).toBeVisible();
    }
  });

  test("menu closes on an outside click without acting", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await expect(page.locator(".context-menu")).toBeVisible();

    await deselectAll(page);
    await expect(page.locator(".context-menu")).toHaveCount(0);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });

  test("Duplicate adds a copy, Delete removes the node", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);

    // The duplicate lands exactly on top of the original (no position offset),
    // so it - not the original - is the one actually hit-testable at that
    // point; .last() targets whichever DOM node paints on top.
    await page.locator(".react-flow__node").last().click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });

  test("Bring to Front / Send to Back reorders overlapping nodes", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await b.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Send to Back" }).click();
    await deselectAll(page);
    const zAfterBack = await b.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    const zOfA = await a.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    expect(zAfterBack).toBeLessThan(zOfA);

    await b.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Bring to Front" }).click();
    await deselectAll(page);
    const zAfterFront = await b.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    const zOfA2 = await a.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    expect(zAfterFront).toBeGreaterThan(zOfA2);
  });

  test("Copy Style then Paste Style applies the copied style to another node", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await a.click();
    await page.locator(".style-panel input[type='color']").first().fill("#ff0000");
    await deselectAll(page);

    await a.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Copy Style" }).click();

    await b.click({ button: "right" });
    const pasteBtn = page.locator(".context-menu").getByRole("menuitem", { name: "Paste Style" });
    await expect(pasteBtn).toBeEnabled();
    await pasteBtn.click();

    await expect(b.locator(".shape-node")).toHaveCSS("background-color", "rgb(255, 0, 0)");
  });

  test("Paste Style is disabled until a style has been copied", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await expect(page.locator(".context-menu").getByRole("menuitem", { name: "Paste Style" })).toBeDisabled();
  });

  test("acts on every selected node when a multi-selection is right-clicked", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await marqueeSelect(page, [a, b]);

    // React Flow renders a selection-bounding-box overlay above the
    // individual nodes once more than one is selected (used for dragging the
    // group) - right-clicking inside the multi-selection hits that overlay,
    // not a specific node underneath, matching real interaction.
    await page.locator(".react-flow__nodesselection-rect").click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(4);
  });

  test("right-clicking an edge opens a menu with only Duplicate and Delete", async ({ diagramPage: page }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);
    await dragHandle(page, decision, "right", process, "left");

    await page.locator(".react-flow__edge").click({ button: "right" });
    const menu = page.locator(".context-menu");
    await expect(menu.getByRole("menuitem", { name: "Duplicate" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Delete" })).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveCount(2);

    await menu.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);

    // The duplicate overlaps the original edge exactly, so it (not the
    // original) is what's actually hit-testable at that point.
    await page.locator(".react-flow__edge").last().click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  });
});
