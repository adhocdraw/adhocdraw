// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, marqueeSelect, settleLayout, spreadNodes } from "./helpers";

test.describe("Style panel", () => {
  test("hides when nothing is selected, shows when a node is selected", async ({ diagramPage: page }) => {
    await expect(page.locator(".style-panel")).toHaveCount(0);
    const node = await addWidget(page, "Process");
    await node.click();
    await expect(page.locator(".style-panel")).toBeVisible();

    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(page.locator(".style-panel")).toHaveCount(0);
  });

  test("changing fill color updates the selected shape", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click();
    const fillInput = page.locator(".style-panel input[type='color']").first();
    await fillInput.fill("#ff0000");
    await expect(node.locator(".shape-node")).toHaveCSS("background-color", "rgb(255, 0, 0)");
  });

  test("changing font size updates selected node text", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Sticky Note");
    await node.click();
    const fontInput = page.locator(".style-panel input[type='number']");
    await fontInput.fill("28");
    await expect(node.locator(".sticky-note-text")).toHaveCSS("font-size", "28px");
  });

  test("style changes apply to every selected node at once", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await marqueeSelect(page, [a, b]);

    const fillInput = page.locator(".style-panel input[type='color']").first();
    await fillInput.fill("#00ff00");

    await expect(a.locator(".shape-node")).toHaveCSS("background-color", "rgb(0, 255, 0)");
    await expect(b.locator(".shape-node")).toHaveCSS("background-color", "rgb(0, 255, 0)");
  });

  test("fill and stroke offer preset color swatches", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click();
    await expect(page.getByRole("group", { name: "Fill presets" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Stroke presets" })).toBeVisible();

    await page.getByRole("button", { name: "Fill #ffe3e3" }).click();
    await expect(node.locator(".shape-node")).toHaveCSS("background-color", "rgb(255, 227, 227)");
    await page.getByRole("button", { name: "Stroke #e03131" }).click();
    await expect(node.locator(".shape-node")).toHaveCSS("border-top-color", "rgb(224, 49, 49)");
    // The active swatch is marked.
    await expect(page.getByRole("button", { name: "Fill #ffe3e3" })).toHaveClass(/active/);
  });

  test("preset swatches apply to every selected shape", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await marqueeSelect(page, [a, b]);
    await page.getByRole("button", { name: "Fill #d3f9d8" }).click();
    await expect(a.locator(".shape-node")).toHaveCSS("background-color", "rgb(211, 249, 216)");
    await expect(b.locator(".shape-node")).toHaveCSS("background-color", "rgb(211, 249, 216)");
  });
});
