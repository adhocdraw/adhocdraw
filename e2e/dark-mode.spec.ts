// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { openShapesPanel } from "./helpers";

test.describe("Dark mode", () => {
  test("toggling dark mode switches the whole UI and back", async ({ diagramPage: page }) => {
    await expect(page.locator(".app")).not.toHaveClass(/dark/);
    await page.getByRole("button", { name: "Dark mode" }).click();
    await expect(page.locator(".app")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Light mode" })).toBeVisible();

    await page.getByRole("button", { name: "Light mode" }).click();
    await expect(page.locator(".app")).not.toHaveClass(/dark/);
  });

  test("dark mode persists across a reload", async ({ diagramPage: page }) => {
    await page.getByRole("button", { name: "Dark mode" }).click();
    await expect(page.locator(".app")).toHaveClass(/dark/);

    await page.goto("/");
    await expect(page.locator(".app")).toHaveClass(/dark/);
  });

  test("existing UI remains functional in dark mode", async ({ diagramPage: page }) => {
    await page.getByRole("button", { name: "Dark mode" }).click();
    await openShapesPanel(page);
    await page.locator(".shapes-panel").getByRole("button", { name: "Process" }).dblclick();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });

  test("no React Flow attribution badge is shown on the canvas", async ({ diagramPage: page }) => {
    await expect(page.locator(".react-flow__attribution")).toHaveCount(0);
  });
});

test("Classic dark: zoom controls and minimap are dark, not white", async ({ diagramPage: page }) => {
  await page.getByRole("button", { name: "Dark mode" }).click();
  for (const sel of [".react-flow__controls", ".react-flow__controls-button", ".react-flow__minimap"]) {
    const bg = await page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg, sel).not.toBe("rgb(255, 255, 255)");
    expect(bg, sel).not.toBe("rgb(254, 254, 254)");
  }
});
