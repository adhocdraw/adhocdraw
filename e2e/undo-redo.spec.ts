// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

// History coalesces rapid changes over a 400ms window, so tests pause briefly
// after each action to let it settle into its own undo step.
const SETTLE_MS = 600;

test.describe("Undo / redo", () => {
  test("undoes and redoes adding a node", async ({ diagramPage: page }) => {
    await addWidget(page, "Sticky Note");
    await page.waitForTimeout(SETTLE_MS);

    await page.keyboard.press("Control+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);

    await page.keyboard.press("Control+Shift+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });

  test("undoes a text edit", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await page.waitForTimeout(SETTLE_MS);

    await node.dblclick();
    await node.locator(".shape-node-textarea").fill("First draft");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(node.locator(".shape-node-text")).toHaveText("First draft");
    await page.waitForTimeout(SETTLE_MS);

    await page.keyboard.press("Control+z");
    await expect(node.locator(".shape-node-text")).toHaveText("");
  });

  test("undo is a no-op once history is exhausted", async ({ diagramPage: page }) => {
    await addWidget(page, "Sticky Note");
    await page.waitForTimeout(SETTLE_MS);

    await page.keyboard.press("Control+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);

    // Nothing further back than the loaded (empty) state - should stay empty,
    // not throw or restore a stale entry.
    await page.keyboard.press("Control+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });
});
