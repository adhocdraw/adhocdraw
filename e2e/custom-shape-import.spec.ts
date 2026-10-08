// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { openDiagram, openShapesPanel } from "./helpers";

const SVG_TRIANGLE = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,5 95,95 5,95" fill="#ffcc00"/></svg>'
);

test.describe("Custom shape import", () => {
  test("uploading an SVG adds a reusable shape button that creates an image node", async ({ diagramPage: page }) => {
    await openShapesPanel(page);
    await page.setInputFiles(".custom-shape-input", {
      name: "triangle.svg",
      mimeType: "image/svg+xml",
      buffer: SVG_TRIANGLE,
    });

    const shapeButton = page.locator(".shape-btn", { hasText: "triangle" });
    await expect(shapeButton).toBeVisible();

    const before = await page.locator(".react-flow__node").count();
    await shapeButton.dblclick();
    await expect(page.locator(".react-flow__node")).toHaveCount(before + 1);
    await expect(page.locator(".react-flow__node-image").last().locator("img")).toBeVisible();
  });

  test("rejects a non-image file with a clear message", async ({ diagramPage: page }) => {
    await openShapesPanel(page);
    await page.setInputFiles(".custom-shape-input", {
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });

    await expect(page.locator(".app-toast")).toContainText("Only SVG or PNG");
    await expect(page.locator(".shape-btn", { hasText: "notes" })).toHaveCount(0);
  });

  test("a custom shape persists through reload", async ({ diagramPage: page, diagram }) => {
    await openShapesPanel(page);
    await page.setInputFiles(".custom-shape-input", {
      name: "triangle.svg",
      mimeType: "image/svg+xml",
      buffer: SVG_TRIANGLE,
    });
    await expect(page.locator(".shape-btn", { hasText: "triangle" })).toBeVisible();
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await openShapesPanel(page);
    await expect(page.locator(".shape-btn", { hasText: "triangle" })).toBeVisible();
  });
});
