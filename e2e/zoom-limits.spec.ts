// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

const zoomOf = (page: import("@playwright/test").Page) =>
  page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

test.describe("Zoom limits", () => {
  test("can zoom in past the old 200% limit", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    const zoomIn = page.getByRole("button", { name: "Zoom In" });
    // Clicks until the button disables itself at the maximum.
    for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) await zoomIn.click();
    await expect.poll(() => zoomOf(page)).toBeGreaterThan(3);
    await expect.poll(() => zoomOf(page)).toBeLessThanOrEqual(5.001);
  });

  test("can zoom out past the old 50% limit", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    const zoomOut = page.getByRole("button", { name: "Zoom Out" });
    for (let i = 0; i < 12 && (await zoomOut.isEnabled()); i++) await zoomOut.click();
    await expect.poll(() => zoomOf(page)).toBeLessThan(0.3);
    await expect.poll(() => zoomOf(page)).toBeGreaterThanOrEqual(0.099);
  });

  test("Fit View still does not zoom a small diagram past 100%", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    await page.getByRole("button", { name: "Fit View" }).click();
    await page.waitForTimeout(400);
    expect(await zoomOf(page)).toBeLessThanOrEqual(1.001);
  });
});
