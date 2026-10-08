// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, createDiagramFromMenu, openDiagram } from "./helpers";

const KEY = "adhocdraw.shapesPanel";

// The shared test fixture starts every test with the panel closed; these
// tests are about the panel itself, so they clear that and look at the real
// default.
async function useDefaultPanelState(page: import("@playwright/test").Page, name: string) {
  await openDiagram(page, name);
  await page.evaluate(() => {
    localStorage.removeItem("adhocdraw.shapesPanel");
    localStorage.removeItem("adhocdraw.panelOffset.shapes");
  });
  await page.reload();
  await page.getByText(name, { exact: true }).click();
}

test.describe("Shapes & Widgets dock", () => {
  test("is open on the left side of the canvas by default", async ({ page, diagram }) => {
    await useDefaultPanelState(page, diagram.name);
    const dock = page.locator(".shapes-dock");
    await expect(dock).toBeVisible();
    await expect(page.locator(".shapes-panel")).toBeVisible();
    const box = await dock.boundingBox();
    const canvas = await page.locator(".canvas-flow").boundingBox();
    if (!box || !canvas) throw new Error("boxes not found");
    expect(box.x - canvas.x).toBeLessThan(40);
    expect(box.x + box.width).toBeLessThan(canvas.x + canvas.width / 2);
  });

  test("collapses to its title bar and expands again, remembered after a reload", async ({ page, diagram }) => {
    await useDefaultPanelState(page, diagram.name);
    await page.locator(".shapes-dock-collapse").click();
    await expect(page.locator(".shapes-panel")).toHaveCount(0);
    await expect(page.locator(".shapes-dock-title")).toBeVisible();

    await page.reload();
    await page.getByText(diagram.name, { exact: true }).click();
    await expect(page.locator(".shapes-dock")).toBeVisible();
    await expect(page.locator(".shapes-panel")).toHaveCount(0);

    await page.locator(".shapes-dock-collapse").click();
    await expect(page.locator(".shapes-panel")).toBeVisible();
  });

  test("closes with the x button and reopens from the toolbar Shapes button", async ({ page, diagram }) => {
    await useDefaultPanelState(page, diagram.name);
    await page.locator(".shapes-dock-close").click();
    await expect(page.locator(".shapes-dock")).toHaveCount(0);

    await page.reload();
    await page.getByText(diagram.name, { exact: true }).click();
    await expect(page.locator(".shapes-dock")).toHaveCount(0);

    await page.locator(".shapes-toggle").click();
    await expect(page.locator(".shapes-panel")).toBeVisible();
    // Clicking the toolbar button again closes it.
    await page.locator(".shapes-toggle").click();
    await expect(page.locator(".shapes-dock")).toHaveCount(0);
  });

  test("the toolbar button expands a collapsed panel instead of closing it", async ({ page, diagram }) => {
    await useDefaultPanelState(page, diagram.name);
    await page.locator(".shapes-dock-collapse").click();
    await page.locator(".shapes-toggle").click();
    await expect(page.locator(".shapes-panel")).toBeVisible();
  });

  test("can be dragged by its grip, remembers where it was left, and resets on double-click", async ({
    page,
    diagram,
  }) => {
    await useDefaultPanelState(page, diagram.name);
    const dock = page.locator(".shapes-dock");
    const start = await dock.boundingBox();
    const grip = dock.locator(".panel-grip");
    const g = await grip.boundingBox();
    if (!start || !g) throw new Error("boxes not found");
    const x = g.x + g.width / 2;
    const y = g.y + g.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 150, y + 80, { steps: 5 });
    await page.mouse.move(x + 300, y + 160, { steps: 5 });
    await page.mouse.up();
    const moved = await dock.boundingBox();
    if (!moved) throw new Error("box not found");
    expect(moved.x - start.x).toBeGreaterThan(250);
    // (Vertically the dock can be as tall as the canvas, so it has no room to move.)

    await page.reload();
    await page.getByText(diagram.name, { exact: true }).click();
    const after = await page.locator(".shapes-dock").boundingBox();
    if (!after) throw new Error("box not found");
    expect(Math.abs(after.x - moved.x)).toBeLessThan(3);
    expect(Math.abs(after.y - moved.y)).toBeLessThan(3);

    await page.locator(".shapes-dock .panel-grip").dblclick();
    const reset = await page.locator(".shapes-dock").boundingBox();
    if (!reset) throw new Error("box not found");
    expect(Math.abs(reset.x - start.x)).toBeLessThan(3);
    expect(Math.abs(reset.y - start.y)).toBeLessThan(3);
  });

  test("adding a shape from the panel leaves the panel open", async ({ page, diagram }) => {
    await useDefaultPanelState(page, diagram.name);
    await page.locator(".shapes-panel").getByRole("button", { name: "Process" }).dblclick();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(page.locator(".shapes-panel")).toBeVisible();
  });

  test("is hidden in presentation mode", async ({ page, diagram }) => {
    await useDefaultPanelState(page, diagram.name);
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(page.locator(".shapes-dock")).toHaveCount(0);
    expect(KEY).toBeTruthy();
  });

  test("clicking the panel's title toggles it, with the chevron icon before the label", async ({ page, diagram }) => {
    await useDefaultPanelState(page, diagram.name);
    const title = page.locator(".shapes-dock-title");
    const chevron = page.locator(".shapes-dock-chevron");
    const chevronBox = await chevron.boundingBox();
    const titleBox = await title.boundingBox();
    if (!chevronBox || !titleBox) throw new Error("boxes not found");
    expect(chevronBox.x + chevronBox.width).toBeLessThanOrEqual(titleBox.x + 1);

    await title.click();
    await expect(page.locator(".shapes-panel")).toHaveCount(0);
    await expect(chevron).toHaveClass(/collapsed/);
    await title.click();
    await expect(page.locator(".shapes-panel")).toBeVisible();
    await expect(chevron).not.toHaveClass(/collapsed/);
  });
});

test("collapsed Shapes dock (classic) is opaque with a solid outline and fully rounded header", async ({
  diagramPage: page,
}) => {
  await page.locator(".shapes-toggle").click();
  await page.locator(".shapes-dock-collapse").click();
  const dock = page.locator(".shapes-dock.collapsed");
  const s = await dock.evaluate((el) => {
    const c = getComputedStyle(el);
    const h = getComputedStyle(el.querySelector(".shapes-dock-header")!);
    return { bg: c.backgroundColor, border: c.borderTopColor, radius: h.borderBottomLeftRadius, overflow: c.overflow };
  });
  expect(s.bg).toBe("rgb(255, 255, 255)");
  expect(s.border).not.toMatch(/rgba\(.*, 0(\.\d+)?\)/);
  expect(parseFloat(s.radius)).toBeGreaterThan(0);
  expect(s.overflow).toBe("hidden");
});

test.describe("Shapes & Widgets dock default by diagram kind", () => {
  test("open on a chart, closed on a White Board and on a Notebook; each kind remembers its own choice", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("adhocdraw.shapesPanel");
      localStorage.removeItem("adhocdraw.shapesPanel.board");
    });
    await page.reload();

    await createDiagramFromMenu(page, `dock-chart-${Date.now()}`, "Blank Chart");
    await expect(page.locator(".shapes-dock")).toBeVisible();

    await createDiagramFromMenu(page, `dock-wb-${Date.now()}`, "White Board");
    await expect(page.locator(".shapes-dock")).toHaveCount(0);
    await createDiagramFromMenu(page, `dock-nb-${Date.now()}`, "Notebook");
    await expect(page.locator(".shapes-dock")).toHaveCount(0);

    // Opening it on a board is remembered for boards only...
    await page.locator(".shapes-toggle").click();
    await expect(page.locator(".shapes-dock")).toBeVisible();
    await createDiagramFromMenu(page, `dock-wb2-${Date.now()}`, "White Board");
    await expect(page.locator(".shapes-dock")).toBeVisible();
    // ...and closing it on a chart does not change the boards.
    await createDiagramFromMenu(page, `dock-chart2-${Date.now()}`, "Blank Chart");
    await expect(page.locator(".shapes-dock")).toBeVisible();
    await page.locator(".shapes-dock-close").click();
    await expect(page.locator(".shapes-dock")).toHaveCount(0);
    await createDiagramFromMenu(page, `dock-nb2-${Date.now()}`, "Notebook");
    await expect(page.locator(".shapes-dock")).toBeVisible();
  });
});
