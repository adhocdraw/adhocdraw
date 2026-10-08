// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { createDiagramFromMenu } from "./helpers";

const focusButton = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Focus mode", exact: true });

test.describe("Focus mode (full-screen editing of White Boards and Notebooks)", () => {
  test("is offered on White Boards and Notebooks, not on charts", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `fm-chart-${Date.now()}`, "Blank Chart");
    await expect(focusButton(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit full screen" })).toHaveCount(0);
    await createDiagramFromMenu(page, `fm-wb-${Date.now()}`, "White Board");
    await expect(focusButton(page)).toBeVisible();
    await createDiagramFromMenu(page, `fm-nb-${Date.now()}`, "Notebook");
    await expect(focusButton(page)).toBeVisible();
  });

  test("a Notebook goes full screen with its panels (palette, tools, zoom, pages) and nothing else; Exit, Esc and F leave it", async ({
    page,
  }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `fm-nb2-${Date.now()}`, "Notebook");
    await expect(page.locator(".canvas-header")).toBeVisible();

    await focusButton(page).click();
    const area = page.locator(".canvas-area");
    await expect(area).toHaveClass(/focus/);
    // Covers the window...
    const box = (await area.boundingBox())!;
    expect(Math.round(box.width)).toBe(page.viewportSize()!.width);
    expect(Math.round(box.height)).toBe(page.viewportSize()!.height);
    // ...without the toolbar or the diagram tabs...
    await expect(page.locator(".canvas-header")).toBeHidden();
    await expect(page.locator(".diagram-tabs")).toBeHidden();
    // ...but with the colour palette (Pencil is on), the tools panel, the zoom row and the page tabs.
    await expect(page.getByRole("group", { name: "Pencil options" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Tool panel" })).toBeVisible();
    await expect(page.locator(".canvas-footer .react-flow__controls")).toBeVisible();
    await expect(page.locator(".canvas-footer .page-tabs")).toBeVisible();
    await expect(page.getByRole("button", { name: "Exit focus mode" })).toBeVisible();

    // Still editable: draw a stroke.
    const flow = (await page.locator(".canvas-flow").boundingBox())!;
    await page.mouse.move(flow.x + 300, flow.y + 250);
    await page.mouse.down();
    await page.mouse.move(flow.x + 420, flow.y + 300, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);

    // Exit button.
    await page.getByRole("button", { name: "Exit focus mode" }).click();
    await expect(area).not.toHaveClass(/focus/);
    await expect(page.locator(".canvas-header")).toBeVisible();
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);

    // F toggles; the first Esc leaves the Pencil, the next leaves focus mode.
    await page.locator(".canvas-flow").click({ position: { x: 5, y: 5 }, button: "right" }).catch(() => {});
    await page.keyboard.press("Escape");
    await page.keyboard.press("f");
    await expect(area).toHaveClass(/focus/);
    await page.keyboard.press("Escape");
    await expect(area).not.toHaveClass(/focus/);
  });

  test("a White Board in focus mode has the palette, tools and zoom but no page tabs", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `fm-wb2-${Date.now()}`, "White Board");
    await focusButton(page).click();
    await expect(page.locator(".canvas-area")).toHaveClass(/focus/);
    await expect(page.getByRole("group", { name: "Tool panel" })).toBeVisible();
    await expect(page.locator(".canvas-footer .react-flow__controls")).toBeVisible();
    await expect(page.locator(".canvas-footer .page-tabs")).toHaveCount(0);
    // The panel's own full-screen button toggles it as well.
    await page.getByRole("button", { name: "Edit full screen" }).click();
    await expect(page.locator(".canvas-area")).not.toHaveClass(/focus/);
  });

  test("Present still works from focus mode and returns to it", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `fm-pres-${Date.now()}`, "Notebook");
    await focusButton(page).click();
    await page.getByRole("button", { name: "Present full screen" }).click();
    await expect(page.locator(".presentation-controls")).toBeVisible();
    await page.getByRole("button", { name: "Exit presentation" }).click();
    await expect(page.locator(".canvas-area")).toHaveClass(/focus/);
  });
});
