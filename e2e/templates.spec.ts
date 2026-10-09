// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { createDiagramFromMenu, readDiagram } from "./helpers";

async function createFromTemplate(page: import("@playwright/test").Page, name: string, templateLabel: string) {
  await page.goto("/");
  await createDiagramFromMenu(page, name, templateLabel);
  await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(name);
}

async function deleteDiagram(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: `Close ${name}` }).click();
  const confirm = page.getByRole("button", { name: "Close anyway" });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
}

test.describe("Diagram templates", () => {
  test("a template is saved as a normal multi-page diagram", async ({ page }) => {
    const name = `tpl-paged-${Date.now()}`;
    await createFromTemplate(page, name, "Blank Chart");
    // The rename is saved a moment after the tab shows it; wait for it to land.
    await expect.poll(async () => !!(await readDiagram(page, name))).toBe(true);
    const diagram = (await readDiagram(page, name))!;
    expect(diagram.data.pages).toHaveLength(1);
    expect(diagram.data.pages[0].name).toBe("Page 1");
    await deleteDiagram(page, name);
  });

  test("Blank Chart template creates an empty diagram", async ({ page }) => {
    const name = `tpl-blank-${Date.now()}`;
    await createFromTemplate(page, name, "Blank Chart");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await deleteDiagram(page, name);
  });

  test("the New menu lists White Board and Notebook first, Blank Chart last, with no heading", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).click();
    const items = page.locator(".new-diagram-flyout .flyout-item");
    await expect(items.nth(0)).toHaveText("White Board");
    await expect(items.nth(1)).toHaveText("Notebook");
    await expect(items.nth(2)).toHaveText("Blank Chart");
    await expect(page.locator(".new-diagram-flyout .flyout-heading")).toHaveCount(0);
    await expect(page.locator(".new-diagram-flyout")).not.toContainText("Create from");
    await expect(page.locator(".new-diagram-flyout .flyout-item", { hasText: /^Blank$/ })).toHaveCount(0);
  });

  test("White Board creates an empty diagram with the Pencil already on", async ({ page }) => {
    const name = `tpl-wb-${Date.now()}`;
    await createFromTemplate(page, name, "White Board");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await expect(page.locator(".pencil-btn")).toHaveClass(/active/);
    await expect(page.getByRole("group", { name: "Pencil options" })).toBeVisible();

    // Draw straight away, no tool to pick first.
    const c = await page.locator(".canvas-flow").boundingBox();
    if (!c) throw new Error("canvas not found");
    await page.mouse.move(c.x + 250, c.y + 250);
    await page.mouse.down();
    await page.mouse.move(c.x + 330, c.y + 290, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(page.locator(".pencil-btn")).not.toHaveClass(/active/);
    await deleteDiagram(page, name);
  });

  test("White Board has no dotted grid backdrop, and keeps that after a reload; other templates keep the dots", async ({
    page,
  }) => {
    const wb = `tpl-wbbg-${Date.now()}`;
    await createFromTemplate(page, wb, "White Board");
    await expect(page.locator(".react-flow__background")).toHaveCount(0);
    await expect(page.locator(".save-status")).toHaveText(/Saved/, { timeout: 5000 });

    await page.reload();
    await page.locator(".diagram-tab", { hasText: wb }).click();
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(wb);
    await expect(page.locator(".react-flow__background")).toHaveCount(0);

    const chart = `tpl-bgchart-${Date.now()}`;
    await createDiagramFromMenu(page, chart, "Blank Chart");
    await expect(page.locator(".react-flow__background")).toHaveCount(1);

    await deleteDiagram(page, chart);
    await deleteDiagram(page, wb);
  });

  test("White Board opens without ruled lines; they can be switched on (dark orange) and the choice is saved; other templates have no such option", async ({
    page,
  }) => {
    const wb = `tpl-rules-${Date.now()}`;
    await createFromTemplate(page, wb, "White Board");
    const rules = page.locator(".notebook-rules");
    const button = page.getByRole("button", { name: "Notebook lines" });
    // Off by default (a Notebook starts with them on).
    await expect(rules).toHaveCount(0);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await button.click();
    await expect(rules).toHaveCount(1);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    // Orange-ish lines: red channel high, blue low.
    const line = await rules.evaluate((el) => getComputedStyle(el).getPropertyValue("--rule"));
    // The browser may report the custom property as #rrggbbaa or rgba(...).
    const hex = line.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
    const rgb = hex ? hex.slice(1, 4).map((h) => parseInt(h, 16)) : (line.match(/\d+/g) ?? []).slice(0, 3).map(Number);
    expect(rgb.length, `unexpected --rule value: "${line}"`).toBe(3);
    expect(rgb[0]).toBeGreaterThan(200);
    expect(rgb[2]).toBeLessThan(100);
    await expect(page.locator(".save-status")).toHaveText(/Saved/, { timeout: 5000 });

    // The toggle lives in the pencil panel, right after the colour options.
    const panel = page.getByRole("group", { name: "Pencil options" });
    await expect(panel.getByRole("button", { name: "Notebook lines" })).toBeVisible();
    const colourBox = await panel.getByLabel("Pencil color").boundingBox();
    const btnBox = await button.boundingBox();
    expect(btnBox!.x).toBeGreaterThan(colourBox!.x);

    await page.reload();
    await page.locator(".diagram-tab", { hasText: wb }).click();
    await expect(page.locator(".notebook-rules")).toHaveCount(1);
    // A reloaded White Board opens with the Pencil on and its palette showing.
    await expect(page.locator(".pencil-btn")).toHaveClass(/active/);
    await expect(page.getByRole("group", { name: "Pencil options" })).toBeVisible();

    // Switching them back off is remembered across a reload too.
    await page.getByRole("button", { name: "Notebook lines" }).click();
    await expect(page.locator(".notebook-rules")).toHaveCount(0);
    await expect(page.locator(".save-status")).toHaveText(/Saved/, { timeout: 5000 });
    await page.reload();
    await page.locator(".diagram-tab", { hasText: wb }).click();
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(wb);
    await expect(page.locator(".notebook-rules")).toHaveCount(0);

    const chart = `tpl-norules-${Date.now()}`;
    await createDiagramFromMenu(page, chart, "Blank Chart");
    // (the Pencil can still be on from the White Board; make sure it is on)
    if (!/active/.test((await page.locator(".pencil-btn").getAttribute("class")) ?? "")) {
      await page.locator(".pencil-btn").click();
    }
    await expect(page.getByRole("group", { name: "Pencil options" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Notebook lines" })).toHaveCount(0);

    await deleteDiagram(page, chart);
    await deleteDiagram(page, wb);
  });

  test("Notebook starts as a copy of the White Board: Pencil on, ruled lines, notebook toggle, kept after a reload", async ({
    page,
  }) => {
    const name = `tpl-nb-${Date.now()}`;
    await createFromTemplate(page, name, "Notebook");
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(/^Notebook \d+$|^tpl-nb-/);
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await expect(page.locator(".pencil-btn")).toHaveClass(/active/);
    await expect(page.getByRole("group", { name: "Pencil options" })).toBeVisible();
    await expect(page.locator(".notebook-rules")).toHaveCount(1);
    await expect(page.locator(".react-flow__background")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Notebook lines" })).toHaveAttribute("aria-pressed", "true");

    // Draws straight away, like the White Board.
    const c = await page.locator(".canvas-flow").boundingBox();
    if (!c) throw new Error("canvas not found");
    await page.mouse.move(c.x + 250, c.y + 250);
    await page.mouse.down();
    await page.mouse.move(c.x + 330, c.y + 290, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
    await expect(page.locator(".save-status")).toHaveText(/Saved/, { timeout: 5000 });

    // Saved as a notebook, so notebook-only features can tell it apart later.
    // The rename is saved a moment after the tab shows it; wait for it to land.
    await expect.poll(async () => !!(await readDiagram(page, name))).toBe(true);
    const diagram = (await readDiagram(page, name))!;
    expect(diagram.data.kind).toBe("notebook");
    expect(diagram.data.background).toBe("lines");

    await page.reload();
    await page.locator(".diagram-tab", { hasText: name }).click();
    await expect(page.locator(".pencil-btn")).toHaveClass(/active/);
    await expect(page.locator(".notebook-rules")).toHaveCount(1);
    await deleteDiagram(page, name);
  });

  test("a Blank Chart does not turn the Pencil on", async ({ page }) => {
    const name = `tpl-nopen-${Date.now()}`;
    await createFromTemplate(page, name, "Blank Chart");
    await expect(page.locator(".pencil-btn")).not.toHaveClass(/active/);
    await deleteDiagram(page, name);
  });
});
