// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragHandle, marqueeSelect, settleLayout, spreadNodes } from "./helpers";

test.describe("Copy / paste / duplicate", () => {
  test("copies and pastes a selected node", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click();
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
  });

  test("duplicates a selected node without touching the clipboard", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Sticky Note");
    await node.click();
    await page.keyboard.press("Control+d");
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
  });

  test("paste does nothing when nothing has been copied", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await page.keyboard.press("Control+v");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });

  test("copying an edge between two selected nodes duplicates the edge too", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Start / End");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await dragHandle(page, a, "bottom", b, "top");
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    // Select both nodes, then copy/paste.
    await marqueeSelect(page, [a, b]);
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");

    await expect(page.locator(".react-flow__node")).toHaveCount(4);
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  });
});
