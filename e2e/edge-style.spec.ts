// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragHandle, openDiagram, settleLayout, spreadNodes } from "./helpers";

test.describe("Edge styling", () => {
  test("selecting an edge shows the edge style panel with connector, line, marker, and label controls", async ({
    diagramPage: page,
  }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);
    await dragHandle(page, decision, "right", process, "left");

    await page.locator(".react-flow__edge").click();
    await expect(page.locator(".edge-style-panel")).toBeVisible();
    await expect(page.locator(".style-panel").getByText("Line")).toBeVisible();
    await expect(page.locator(".style-panel label", { hasText: "Start" })).toBeVisible();
    await expect(page.locator(".style-panel label", { hasText: "End" })).toBeVisible();
    await expect(page.locator(".style-panel").getByText("Label")).toBeVisible();
  });

  test("changing line style to dashed updates the rendered edge and persists through reload", async ({
    diagramPage: page,
    diagram,
  }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);
    await dragHandle(page, decision, "right", process, "left");

    await page.locator(".react-flow__edge").click();
    await page.locator(".edge-style-panel label", { hasText: "Line" }).locator("select").selectOption("dashed");
    await expect(page.locator(".react-flow__edge-path").first()).toHaveCSS("stroke-dasharray", /8/);
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await expect(page.locator(".react-flow__edge-path").first()).toHaveCSS("stroke-dasharray", /8/);
  });

  // Double-click on the edge path itself is reserved for adding a waypoint
  // (see e2e/edge-waypoints.spec.ts), so a first-time label is set via the
  // style panel; double-clicking the rendered label re-opens it for editing.
  test("double-clicking an existing label opens it for inline editing", async ({ diagramPage: page }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);
    await dragHandle(page, decision, "right", process, "left");

    await page.locator(".react-flow__edge").click();
    await page.locator(".edge-style-panel input[type='text']").fill("yes");
    await page.locator(".edge-style-panel input[type='text']").blur();
    await expect(page.locator(".edge-label-text")).toHaveText("yes");

    await page.locator(".edge-label-text").dblclick();
    await page.locator(".edge-label-input").fill("approved");
    await page.keyboard.press("Enter");

    await expect(page.locator(".edge-label-text")).toHaveText("approved");
  });

  test("edge label set via the style panel persists through reload", async ({ diagramPage: page, diagram }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);
    await dragHandle(page, decision, "right", process, "left");

    await page.locator(".react-flow__edge").click();
    await page.locator(".edge-style-panel input[type='text']").fill("approved");
    await page.locator(".edge-style-panel input[type='text']").blur();
    await expect(page.locator(".edge-label-text")).toHaveText("approved");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await expect(page.locator(".edge-label-text")).toHaveText("approved");
  });
});
