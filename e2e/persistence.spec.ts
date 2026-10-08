// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragHandle, openDiagram, settleLayout, spreadNodes } from "./helpers";

test.describe("Autosave and persistence", () => {
  test("persists nodes across a page reload", async ({ diagramPage: page, diagram }) => {
    const node = await addWidget(page, "Process");
    await node.dblclick();
    await node.locator(".shape-node-textarea").fill("Persisted step");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(page.locator(".shape-node-text")).toHaveText("Persisted step");
  });

  test("persists an edge across a page reload", async ({ diagramPage: page, diagram }) => {
    const a = await addWidget(page, "Start / End");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await dragHandle(page, a, "bottom", b, "top");

    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  });
});
