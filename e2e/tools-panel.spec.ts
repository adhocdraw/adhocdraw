// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, createDiagramFromMenu } from "./helpers";

// The panel is for White Boards and Notebooks: these tests run on a White Board
// (the first test also covers Notebook and the absence of the panel on charts).
test.describe("Icon-only tools panel", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.title.startsWith("is only on")) return;
    await page.goto("/");
    await createDiagramFromMenu(page, `tools-${Date.now()}`, "White Board");
    // A White Board opens with the Pencil on; start each test from no tool.
    if (/active/.test((await page.locator(".pencil-btn").getAttribute("class")) ?? "")) {
      await page.locator(".pencil-btn").click();
    }
    await expect(page.locator(".pencil-btn")).not.toHaveClass(/active/);
  });

  test("is only on White Boards and Notebooks, not on charts", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `tools-chart-${Date.now()}`, "Blank Chart");
    await expect(page.getByRole("group", { name: "Tool panel" })).toHaveCount(0);
    await createDiagramFromMenu(page, `tools-wb-${Date.now()}`, "White Board");
    await expect(page.getByRole("group", { name: "Tool panel" })).toBeVisible();
    await createDiagramFromMenu(page, `tools-nb-${Date.now()}`, "Notebook");
    await expect(page.getByRole("group", { name: "Tool panel" })).toBeVisible();
    // ...and it is still there after a reload (the board is recognised when it loads).
    await page.reload();
    await expect(page.getByRole("group", { name: "Tool panel" })).toBeVisible();
  });

  test("shows the draw tools as icons only, floating over the canvas", async ({ page }) => {
    const panel = page.getByRole("group", { name: "Tool panel" });
    await expect(panel).toBeVisible();
    const buttons = panel.getByRole("button");
    await expect(buttons).toHaveCount(11);
    for (let i = 0; i < 11; i++) {
      expect(((await buttons.nth(i).textContent()) ?? "").trim()).toBe("");
      await expect(buttons.nth(i).locator("svg.toolbar-icon")).toHaveCount(1);
    }
    const flow = (await page.locator(".canvas-flow").boundingBox())!;
    const b = (await panel.boundingBox())!;
    expect(b.y).toBeGreaterThan(flow.y);
    expect(b.y + b.height).toBeLessThanOrEqual(flow.y + flow.height);
  });

  test("its buttons do what the toolbar's Draw buttons do and stay in step with them", async ({ page }) => {
    const panel = page.getByRole("group", { name: "Tool panel" });

    await panel.getByRole("button", { name: "Freehand" }).click();
    await expect(page.locator(".pencil-btn")).toHaveClass(/active/);
    await expect(panel.getByRole("button", { name: "Freehand" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "Pencil options" })).toBeVisible();

    await panel.getByRole("button", { name: "Marquee" }).click();
    await expect(page.locator(".select-mode-btn")).toHaveClass(/active/);
    await expect(panel.getByRole("button", { name: "Freehand" })).toHaveAttribute("aria-pressed", "false");

    await panel.getByRole("button", { name: "Type text" }).click();
    await expect(page.getByRole("button", { name: "Text tool" })).toHaveAttribute("aria-pressed", "true");
    // ...and the toolbar's buttons update the panel.
    await page.locator(".pencil-btn").click();
    await expect(panel.getByRole("button", { name: "Freehand" })).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByRole("button", { name: "Type text" })).toHaveAttribute("aria-pressed", "false");

    // Shapes: opens and closes the Shapes & Widgets dock.
    await panel.getByRole("button", { name: "Shape library" }).click();
    await expect(page.locator(".shapes-dock")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Shape library" })).toHaveAttribute("aria-pressed", "true");
    await panel.getByRole("button", { name: "Shape library" }).click();
    await expect(page.locator(".shapes-dock")).toHaveCount(0);

    // Snap to grid: on by default; toggles with the toolbar checkbox.
    const snap = panel.getByRole("button", { name: "Grid snapping" });
    await expect(snap).toHaveAttribute("aria-pressed", "true");
    await snap.click();
    await expect(page.getByRole("checkbox", { name: "Snap to grid" })).not.toBeChecked();
    await expect(snap).toHaveAttribute("aria-pressed", "false");
  });

  test("it can be dragged by its grip, double-click resets it, and presentation mode hides it", async ({ page }) => {
    const panel = page.getByRole("group", { name: "Tool panel" });
    const grip = panel.locator(".panel-grip");
    const before = (await panel.boundingBox())!;
    const g = (await grip.boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + g.width / 2 + 200, g.y + g.height / 2 - 150, { steps: 6 });
    await page.mouse.up();
    const moved = (await panel.boundingBox())!;
    expect(moved.x).toBeGreaterThan(before.x + 150);
    expect(moved.y).toBeLessThan(before.y - 100);
    await grip.dblclick();
    const reset = (await panel.boundingBox())!;
    expect(Math.abs(reset.x - before.x)).toBeLessThan(3);

    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(panel).toHaveCount(0);
  });

  test("the Hand tool sits right after Shapes and lets you drag the canvas around without touching shapes", async ({ page }) => {
    const panel = page.getByRole("group", { name: "Tool panel" });
    const x = async (name: string) => (await panel.getByRole("button", { name }).boundingBox())!.x;
    const shapes = await x("Shape library");
    const hand = await x("Pan");
    const select = await x("Marquee");
    expect(hand).toBeGreaterThan(shapes);
    expect(select).toBeGreaterThan(hand);

    const node = await addWidget(page, "Process");
    const nodePos = () => node.evaluate((el) => getComputedStyle(el).transform);
    const viewport = () => page.locator(".react-flow__viewport").evaluate((el) => getComputedStyle(el).transform);
    const nodeBefore = await nodePos();
    const viewBefore = await viewport();

    await page.keyboard.press("h");
    await expect(panel.getByRole("button", { name: "Pan" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".canvas-flow")).toHaveClass(/canvas-flow-hand/);

    // Dragging on the shape itself pans the canvas; the shape does not move relative to the canvas.
    const b = (await node.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 120, b.y + b.height / 2 + 60, { steps: 8 });
    await page.mouse.up();
    expect(await nodePos()).toBe(nodeBefore);
    expect(await viewport()).not.toBe(viewBefore);
    // Not selected by the click, either.
    await expect(node).not.toHaveClass(/selected/);

    // Exclusive with the other tools; Esc leaves it.
    await panel.getByRole("button", { name: "Freehand" }).click();
    await expect(panel.getByRole("button", { name: "Pan" })).toHaveAttribute("aria-pressed", "false");
    await panel.getByRole("button", { name: "Pan" }).click();
    await expect(page.locator(".pencil-btn")).not.toHaveClass(/active/);
    await page.keyboard.press("Escape");
    await expect(panel.getByRole("button", { name: "Pan" })).toHaveAttribute("aria-pressed", "false");
    // Back to normal: dragging the shape moves it.
    const b2 = (await node.boundingBox())!;
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await page.mouse.down();
    await page.mouse.move(b2.x + b2.width / 2 + 90, b2.y + b2.height / 2 + 50, { steps: 8 });
    await page.mouse.up();
    expect(await nodePos()).not.toBe(nodeBefore);
  });

  test("the toolbar's Draw group has a Hand button too, in step with the panel's", async ({ page }) => {
    const panel = page.getByRole("group", { name: "Tool panel" });
    const hand = page.getByRole("button", { name: "Hand", exact: true });
    // Right after Shapes in the Draw group.
    const draw = page.getByRole("group", { name: "Draw", exact: true });
    const labels = await draw.evaluate((el) =>
      Array.from(el.querySelectorAll(":scope > button")).map((b) => (b.textContent ?? "").trim())
    );
    expect(labels.slice(0, 3)).toEqual(["Shapes", "Hand", "Select"]);

    await hand.click();
    await expect(hand).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByRole("button", { name: "Pan" })).toHaveAttribute("aria-pressed", "true");
    await panel.getByRole("button", { name: "Pan" }).click();
    await expect(hand).toHaveAttribute("aria-pressed", "false");
  });

  test("Focus then Present are the last two icons, set apart from the drawing tools by a separator; Present starts the presentation", async ({
    page,
  }) => {
    const panel = page.getByRole("group", { name: "Tool panel" });
    const names = await panel.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(names.slice(-3)).toEqual(["Grid snapping", "Edit full screen", "Present full screen"]);
    const sep = (await panel.locator(".tools-sep").last().boundingBox())!;
    const snap = (await panel.getByRole("button", { name: "Grid snapping" }).boundingBox())!;
    const focus = (await panel.getByRole("button", { name: "Edit full screen" }).boundingBox())!;
    const present = (await panel.getByRole("button", { name: "Present full screen" }).boundingBox())!;
    expect(sep.x).toBeGreaterThan(snap.x + snap.width - 1);
    expect(sep.x + sep.width).toBeLessThan(focus.x + 1);
    expect(present.x).toBeGreaterThan(focus.x + focus.width - 1);
    await expect(panel.locator(".tools-sep")).toHaveCount(2); // after Redo, and before Focus

    await panel.getByRole("button", { name: "Present full screen" }).click();
    await expect(page.locator(".presentation-controls")).toBeVisible();
  });

  test("in the View toolbar the Focus mode icon comes before the Present icon", async ({ page }) => {
    const view = page.getByRole("group", { name: "View and present" });
    const names = await view.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(names).toEqual(["History", "Find", "Focus mode", "Present"]);
  });

  test("Undo and Redo come first, with a separator after them; they enable as there is history and undo/redo changes", async ({
    page,
  }) => {
    const panel = page.getByRole("group", { name: "Tool panel" });
    const names = await panel.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(names.slice(0, 3)).toEqual(["Undo", "Redo", "Shape library"]);
    const undo = panel.getByRole("button", { name: "Undo" });
    const redo = panel.getByRole("button", { name: "Redo" });
    const sep = (await panel.locator(".tools-sep").first().boundingBox())!;
    const rb = (await redo.boundingBox())!;
    const sb = (await panel.getByRole("button", { name: "Shape library" }).boundingBox())!;
    expect(sep.x).toBeGreaterThan(rb.x + rb.width - 1);
    expect(sep.x + sep.width).toBeLessThan(sb.x + 1);
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();

    await addWidget(page, "Process");
    await expect(undo).toBeEnabled({ timeout: 5000 });
    await expect(redo).toBeDisabled();

    await undo.click();
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await expect(redo).toBeEnabled();
    await expect(undo).toBeDisabled();

    await redo.click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(redo).toBeDisabled();
    await expect(undo).toBeEnabled();
  });
});
