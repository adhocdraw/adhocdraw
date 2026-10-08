// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

const view = (page: Page) =>
  page.locator(".react-flow__viewport").evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, zoom: m.a };
  });

async function canvasCenter(page: Page) {
  const b = await page.locator(".canvas-flow").boundingBox();
  if (!b) throw new Error("canvas not found");
  return { box: b, x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test.describe("Moving around while the Pencil is on", () => {
  test("the mouse wheel / trackpad scroll pans instead of zooming", async ({ diagramPage: page }) => {
    await page.locator(".pencil-btn").click();
    const before = await view(page);
    const c = await canvasCenter(page);
    await page.mouse.move(c.x, c.y);
    await page.mouse.wheel(150, 300);
    await expect.poll(async () => (await view(page)).y).toBeLessThan(before.y - 50);
    await expect.poll(async () => (await view(page)).x).toBeLessThan(before.x - 20);
    expect((await view(page)).zoom).toBeCloseTo(before.zoom, 3);
  });

  test("Ctrl/Cmd + wheel still zooms in pencil mode", async ({ diagramPage: page }) => {
    await page.locator(".pencil-btn").click();
    const before = await view(page);
    const c = await canvasCenter(page);
    await page.mouse.move(c.x, c.y);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -300);
    await page.keyboard.up("Control");
    await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(before.zoom + 0.05);
  });

  test("without the Pencil, the wheel zooms as before", async ({ diagramPage: page }) => {
    const before = await view(page);
    const c = await canvasCenter(page);
    await page.mouse.move(c.x, c.y);
    await page.mouse.wheel(0, -300);
    await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(before.zoom + 0.05);
  });

  test("holding Space and dragging pans without drawing, and drawing resumes on release", async ({
    diagramPage: page,
  }) => {
    await page.locator(".pencil-btn").click();
    const c = await canvasCenter(page);
    const before = await view(page);

    await page.keyboard.down("Space");
    await expect(page.locator(".canvas-flow")).toHaveClass(/canvas-flow-panning/);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x - 120, c.y - 80, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up("Space");

    await expect.poll(async () => (await view(page)).x).toBeLessThan(before.x - 80);
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(0);
    await expect(page.locator(".canvas-flow")).not.toHaveClass(/canvas-flow-panning/);
    await expect(page.locator(".pencil-btn")).toHaveClass(/active/);

    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 80, c.y + 40, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
  });

  test("dragging with the middle mouse button pans without drawing", async ({ diagramPage: page }) => {
    await page.locator(".pencil-btn").click();
    const c = await canvasCenter(page);
    const before = await view(page);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(c.x - 100, c.y - 60, { steps: 6 });
    await page.mouse.up({ button: "middle" });
    await expect.poll(async () => (await view(page)).x).toBeLessThan(before.x - 60);
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(0);
  });

  test("drawing against the canvas edge scrolls the view so the stroke can continue", async ({
    diagramPage: page,
  }) => {
    await page.locator(".pencil-btn").click();
    const c = await canvasCenter(page);
    const before = await view(page);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.box.x + c.box.width - 10, c.y, { steps: 10 });
    await page.waitForTimeout(700); // hold at the edge: the view keeps scrolling
    await page.mouse.up();

    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
    // The view moved right (content shifted left) and the stroke is longer
    // than the distance the pointer itself covered.
    expect((await view(page)).x).toBeLessThan(before.x - 100);
    const stroke = await page.locator(".react-flow__node-freehand").evaluate((el) => parseFloat((el as HTMLElement).style.width));
    expect(stroke).toBeGreaterThan(c.box.width / 2 + 60);
  });

  test("letting go of the mouse outside the canvas still finishes the stroke", async ({ diagramPage: page }) => {
    await page.locator(".pencil-btn").click();
    const c = await canvasCenter(page);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 60, c.y + 30, { steps: 5 });
    await page.mouse.move(c.box.x + c.box.width + 60, c.y, { steps: 5 }); // beyond the right edge
    await page.mouse.up();
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
    // A new stroke can be started right away (no stuck "drawing" state).
    await page.mouse.move(c.x - 100, c.y - 100);
    await page.mouse.down();
    await page.mouse.move(c.x - 40, c.y - 60, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(2);
  });

  test("pressing Space right after clicking the Pencil button does not switch the Pencil off", async ({
    diagramPage: page,
  }) => {
    await page.locator(".pencil-btn").click();
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await expect(page.locator(".pencil-btn")).toHaveClass(/active/);
  });

  test("Space still types normally in the options panel's fields", async ({ diagramPage: page }) => {
    await page.locator(".pencil-btn").click();
    await page.getByLabel("Pencil line style").focus();
    await page.keyboard.press("Space");
    await expect(page.locator(".canvas-flow")).not.toHaveClass(/canvas-flow-panning/);
  });
});
