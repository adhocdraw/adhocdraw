// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragNodeTo, settleLayout, readDiagram } from "./helpers";

test.describe("Node locking", () => {
  test("right-click shows Lock, toggles to Unlock, and shows a lock badge", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await expect(page.locator(".context-menu").getByRole("menuitem", { name: "Lock" })).toBeVisible();
    await page.locator(".context-menu").getByRole("menuitem", { name: "Lock" }).click();

    await expect(node.locator(".node-lock-badge")).toBeVisible();

    await node.click({ button: "right" });
    await expect(page.locator(".context-menu").getByRole("menuitem", { name: "Unlock" })).toBeVisible();
    await page.locator(".context-menu").getByRole("menuitem", { name: "Unlock" }).click();
    await expect(node.locator(".node-lock-badge")).toHaveCount(0);
  });

  test("a locked node ignores drag and stays in place", async ({ diagramPage: page, diagram }) => {
    const node = await addWidget(page, "Process");
    await settleLayout(page);
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    await dragNodeTo(page, node, canvasBox.x + 200, canvasBox.y + 200);

    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Lock" }).click();
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    const beforePos = (await readDiagram(page, diagram.id))!.data.pages[0].nodes[0].position;

    await dragNodeTo(page, node, canvasBox.x + 400, canvasBox.y + 400);
    await page.waitForTimeout(700);

    const afterPos = (await readDiagram(page, diagram.id))!.data.pages[0].nodes[0].position;
    expect(afterPos).toEqual(beforePos);
  });

  test("a locked node ignores double-click editing and hides its resize handles", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Lock" }).click();

    await node.dblclick();
    await expect(node.locator(".shape-node-textarea")).toHaveCount(0);
    await expect(page.locator(".react-flow__resize-control")).toHaveCount(0);
  });

  test("a locked node remains selectable and deletable", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Lock" }).click();

    await node.click();
    await expect(node).toHaveClass(/selected/);
    await page.keyboard.press("Delete");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });

  test("lock state persists through reload", async ({ diagramPage: page, diagram }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Lock" }).click();
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await page.goto("/");
    await page.getByText(diagram.name, { exact: true }).click();
    await expect(page.locator(".react-flow__node").locator(".node-lock-badge")).toBeVisible();
  });
});
