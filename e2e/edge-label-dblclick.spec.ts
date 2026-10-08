// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dblclickEdgePath, dragHandle, settleLayout, spreadNodes } from "./helpers";

test.describe("Edge label via double-click", () => {
  test("double-clicking an arrow opens an inline label editor and saves the text", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await dragHandle(page, a, "right", b, "left");

    await dblclickEdgePath(page);
    await expect(page.locator(".edge-label-input")).toBeVisible();
    await page.locator(".edge-label-input").fill("yes");
    await page.keyboard.press("Enter");

    await expect(page.locator(".edge-label-text")).toHaveText("yes");
    // Double-click no longer adds a bend point.
    await expect(page.locator(".edge-waypoint")).toHaveCount(0);
  });
});
