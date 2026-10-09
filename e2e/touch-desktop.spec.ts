// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { openShapesPanel } from "./helpers";

// The phone changes (touch.spec.ts) must not touch a desktop browser: a real
// desktop profile, mouse input, wide window.
test.use({ viewport: { width: 1400, height: 800 }, isMobile: false, hasTouch: false });

test.describe("Desktop is unchanged by the phone layout", () => {
  test("on a wide screen the Shapes dock still starts open", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("adhocdraw.shapesPanel"));
    await page.reload();
    await page.getByRole("button", { name: /^New/ }).click();
    await page.locator(".flyout-item", { hasText: /^Blank Chart$/ }).click();
    await expect(page.locator(".shapes-dock")).toBeVisible();
    await expect(page.locator(".shapes-dock")).not.toHaveClass(/collapsed/);
  });

  test("on a wide screen a new diagram still starts at 100%", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).click();
    await page.locator(".flyout-item", { hasText: /^Blank Chart$/ }).click();
    await expect(page.locator(".controls-zoom-value")).toHaveText("100%");
  });

  test("on a wide screen the Draw group, Focus, Present and shape labels all stay", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).click();
    await page.locator(".flyout-item", { hasText: /^White Board$/ }).click();
    await expect(page.getByRole("group", { name: "Draw" })).toBeVisible();
    await expect(page.locator(".focus-mode-btn")).toBeVisible();
    await expect(page.locator(".present-btn")).toBeVisible();
    await page.getByRole("button", { name: /^New/ }).click();
    await page.locator(".flyout-item", { hasText: /^Blank Chart$/ }).click();
    await openShapesPanel(page);
    await expect(page.locator(".shape-btn-label").first()).toBeVisible();
  });

  test("on a wide screen the Shapes dock keeps its full title and close button", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).click();
    await page.locator(".flyout-item", { hasText: /^Blank Chart$/ }).click();
    await openShapesPanel(page);
    await expect(page.locator(".shapes-dock-title-full")).toBeVisible();
    await expect(page.locator(".shapes-dock-title-short")).toBeHidden();
    await expect(page.locator(".shapes-dock-close")).toBeVisible();
  });
});
