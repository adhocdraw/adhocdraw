// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { createDiagramFromMenu, dragNodeTo, addWidget, readDiagram } from "./helpers";

// A Notebook is a page: fixed width, scrolled down only. (A White Board stays an
// infinite canvas.)
const viewport = (page: import("@playwright/test").Page) =>
  page.locator(".react-flow__viewport").evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.m41, y: m.m42, zoom: m.a };
  });

test.describe("Notebook page mode", () => {
  test("a Notebook is a sheet of paper on the desk, with the ruled lines and a margin line on it", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `nb-${Date.now()}`, "Notebook");
    const paper = page.getByTestId("notebook-page");
    await expect(paper).toHaveCount(1);
    const v = await viewport(page);
    const box = (await paper.boundingBox())!;
    expect(Math.abs(box.width - 800 * v.zoom)).toBeLessThan(2);
    // On the paper: ruled lines and the red margin line.
    await expect(paper.locator(".notebook-margin-line")).toHaveCount(1);
    expect(await paper.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("linear-gradient");
    // Turning "Notebook lines" off leaves the plain page.
    await page.getByRole("button", { name: "Notebook lines" }).click();
    await expect(paper.locator(".notebook-margin-line")).toHaveCount(0);
    await expect(page.getByTestId("notebook-page")).toHaveCount(1);
  });

  test("scrolling only goes up and down the page: never sideways, never above the top", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `nb-${Date.now()}`, "Notebook");
    const c = (await page.locator(".canvas-flow").boundingBox())!;
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    const start = await viewport(page);
    expect(Math.abs(start.y)).toBeLessThan(1);

    await page.mouse.wheel(0, 500);
    await expect.poll(async () => (await viewport(page)).y).toBeLessThan(start.y - 200);
    const down = await viewport(page);
    expect(down.x).toBeCloseTo(start.x, 0);
    expect(down.zoom).toBeCloseTo(start.zoom, 3); // the wheel scrolls, it does not zoom

    // Sideways scrolling does nothing.
    await page.mouse.wheel(600, 0);
    await page.waitForTimeout(250);
    expect((await viewport(page)).x).toBeCloseTo(start.x, 0);

    // And back up: it stops at the top of the page.
    await page.mouse.wheel(0, -5000);
    await expect.poll(async () => (await viewport(page)).y).toBeGreaterThan(-1);
    expect((await viewport(page)).y).toBeLessThanOrEqual(1);
  });

  test("a shape cannot be dragged off the page sideways", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `nb-${Date.now()}`, "Notebook");
    const node = await addWidget(page, "Process");
    // Leave the pencil so dragging moves shapes.
    await page.keyboard.press("Escape");
    const paper = (await page.getByTestId("notebook-page").boundingBox())!;
    const c = (await page.locator(".canvas-flow").boundingBox())!;
    await dragNodeTo(page, node, c.x + c.width - 5, c.y + 300);
    const box = (await node.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(paper.x + paper.width + 1);
    await dragNodeTo(page, node, c.x + 5, c.y + 320);
    expect((await node.boundingBox())!.x).toBeGreaterThanOrEqual(paper.x - 1);
  });

  test("a White Board is still an infinite canvas: no paper, and it pans sideways", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `wb-${Date.now()}`, "White Board");
    await expect(page.getByTestId("notebook-page")).toHaveCount(0);
    const c = (await page.locator(".canvas-flow").boundingBox())!;
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    const before = await viewport(page);
    await page.mouse.wheel(300, 0);
    await expect.poll(async () => Math.abs((await viewport(page)).x - before.x)).toBeGreaterThan(50);
  });

  test("a Notebook is still a Notebook (a page) after a reload", async ({ page }) => {
    await page.goto("/");
    const name = `nb-${Date.now()}`;
    await createDiagramFromMenu(page, name, "Notebook");
    await expect(page.getByTestId("notebook-page")).toHaveCount(1);
    await expect.poll(async () => !!(await readDiagram(page, name))).toBe(true);
    await page.reload();
    await page.locator(".diagram-tab", { hasText: name }).click();
    await expect(page.getByTestId("notebook-page")).toHaveCount(1);
  });
});
