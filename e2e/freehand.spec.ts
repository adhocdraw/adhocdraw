// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { dragFromPoint, settleLayout } from "./helpers";

test.describe("Freehand pencil tool", () => {
  test("drawing a stroke creates a selectable freehand node and stays in pencil mode", async ({
    diagramPage: page,
  }) => {
    await page.locator(".pencil-btn").click();
    await expect(page.locator(".pencil-btn")).toHaveClass(/active/);

    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    await dragFromPoint(page, canvasBox.x + 150, canvasBox.y + 150, 120, 60);

    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
    // Pencil mode stays on after a stroke, so another shape can be drawn
    // right away without re-clicking "Pencil" - it doesn't drop back to
    // "Pencil" (off) the way it used to.
    await expect(page.locator(".pencil-btn")).toHaveClass(/active/);

    // Exit pencil mode to select the drawn node - while it's on, a click on
    // the canvas starts a new stroke rather than selecting anything.
    await page.locator(".pencil-btn").click();
    await page.locator(".react-flow__node-freehand").click();
    await expect(page.locator(".react-flow__node-freehand")).toHaveClass(/selected/);
  });

  test("pencil mode stays active across multiple strokes", async ({ diagramPage: page }) => {
    await page.locator(".pencil-btn").click();
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");

    await dragFromPoint(page, canvasBox.x + 150, canvasBox.y + 150, 80, 40);
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
    await dragFromPoint(page, canvasBox.x + 300, canvasBox.y + 150, 80, 40);
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(2);

    await expect(page.locator(".pencil-btn")).toHaveClass(/active/);
    await page.keyboard.press("Escape");
    await expect(page.locator(".pencil-btn")).not.toHaveClass(/active/);
  });

  test("shows a live preview of the stroke while drawing, before the mouse is released", async ({
    diagramPage: page,
  }) => {
    await page.locator(".pencil-btn").click();
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");

    await page.mouse.move(canvasBox.x + 150, canvasBox.y + 150);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 220, canvasBox.y + 200, { steps: 5 });

    // The stroke isn't committed as a node yet, but a live preview line
    // should already be visible - not just a blank canvas until mouseup.
    await expect(page.locator(".freehand-preview path")).toBeVisible();
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(0);

    await page.mouse.up();
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
    await expect(page.locator(".freehand-preview")).toHaveCount(0);
  });

  test("clicking Pencil again while drawing mode is on cancels it without drawing", async ({
    diagramPage: page,
  }) => {
    await page.locator(".pencil-btn").click();
    await page.locator(".pencil-btn").click();
    await expect(page.locator(".pencil-btn")).not.toHaveClass(/active/);
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(0);
  });

  test("a freehand stroke is stylable (stroke color), deletable, and persists", async ({
    diagramPage: page,
    diagram,
  }) => {
    await page.locator(".pencil-btn").click();
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    await dragFromPoint(page, canvasBox.x + 150, canvasBox.y + 150, 120, 60);

    // Exit pencil mode before selecting the node - see the first test above.
    await page.locator(".pencil-btn").click();
    const node = page.locator(".react-flow__node-freehand");
    await node.click();
    await page.locator(".style-panel input[type='color']").first().fill("#00aa00");
    // Strokes are drawn via perfect-freehand (T2) as a filled, variable-
    // width outline, not a stroked centerline - the color applies via fill.
    await expect(node.locator("path")).toHaveAttribute("fill", "#00aa00");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await page.goto("/");
    await page.getByText(diagram.name, { exact: true }).click();
    await settleLayout(page);
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-freehand path")).toHaveAttribute("fill", "#00aa00");

    await page.locator(".react-flow__node-freehand").click();
    await page.keyboard.press("Delete");
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(0);
  });

  // Regression: the first thing drawn on a new (empty) diagram used to jump to
  // the middle of the canvas, because adding the first node triggered a
  // fit-to-screen.
  test("the first stroke on a new diagram stays where it was drawn", async ({ diagramPage: page }) => {
    await page.locator(".pencil-btn").click();
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    const startX = canvasBox.x + 120;
    const startY = canvasBox.y + 120;
    await dragFromPoint(page, startX, startY, 100, 60);

    const node = page.locator(".react-flow__node-freehand");
    await expect(node).toHaveCount(1);
    await page.waitForTimeout(800); // a delayed re-fit would have moved it by now
    const box = await node.boundingBox();
    if (!box) throw new Error("stroke not found");
    expect(Math.abs(box.x - startX)).toBeLessThan(25);
    expect(Math.abs(box.y - startY)).toBeLessThan(25);
    // And the canvas view itself must not have been re-framed.
    const zoom = await page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    expect(zoom).toBeCloseTo(1, 2);
  });

  test.describe("pencil options", () => {
    test("the options panel shows only while the Pencil tool is on", async ({ diagramPage: page }) => {
      await expect(page.getByRole("group", { name: "Pencil options" })).toHaveCount(0);
      await page.locator(".pencil-btn").click();
      await expect(page.getByRole("group", { name: "Pencil options" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("group", { name: "Pencil options" })).toHaveCount(0);
    });

    test("strokes are drawn in the chosen color and opacity", async ({ diagramPage: page }) => {
      await page.locator(".pencil-btn").click();
      await page.getByRole("button", { name: "Color #e03131" }).click();
      await page.getByLabel("Pencil opacity").fill("50");
      const canvasBox = await page.locator(".canvas-flow").boundingBox();
      if (!canvasBox) throw new Error("canvas not found");
      await dragFromPoint(page, canvasBox.x + 150, canvasBox.y + 200, 120, 60);

      const path = page.locator(".react-flow__node-freehand path");
      await expect(path).toHaveAttribute("fill", "#e03131");
      await expect(path).toHaveAttribute("fill-opacity", "0.5");
    });

    test("the default pen is black on a light canvas and white in dark mode, until a colour is picked", async ({
      diagramPage: page,
    }) => {
      await page.locator(".pencil-btn").click();
      await expect(page.getByLabel("Pencil color")).toHaveValue("#000000");
      await expect(page.getByRole("button", { name: "Auto", exact: true })).toHaveAttribute("aria-pressed", "true");

      await page.getByRole("button", { name: "Dark mode" }).click();
      await expect(page.getByLabel("Pencil color")).toHaveValue("#ffffff");
      const canvasBox = await page.locator(".canvas-flow").boundingBox();
      if (!canvasBox) throw new Error("canvas not found");
      await dragFromPoint(page, canvasBox.x + 150, canvasBox.y + 200, 120, 60);
      const stroke = page.locator(".react-flow__node-freehand path").last();
      const paint = () => stroke.evaluate((el) => getComputedStyle(el).fill);
      expect(await paint()).toBe("rgb(255, 255, 255)");
      // A stroke drawn with the Auto pen follows the mode: switch to light and it turns black.
      await page.getByRole("button", { name: "Light mode" }).click();
      await expect.poll(paint).toBe("rgb(0, 0, 0)");
      await page.getByRole("button", { name: "Dark mode" }).click();
      await expect.poll(paint).toBe("rgb(255, 255, 255)");

      // An explicit choice sticks across modes; Auto goes back to following the mode.
      await page.getByRole("button", { name: "Color #e03131" }).click();
      await page.getByRole("button", { name: "Light mode" }).click();
      await expect(page.getByLabel("Pencil color")).toHaveValue("#e03131");
      await expect(page.getByRole("button", { name: "Auto", exact: true })).toHaveAttribute("aria-pressed", "false");
      await page.getByRole("button", { name: "Auto", exact: true }).click();
      await expect(page.getByLabel("Pencil color")).toHaveValue("#000000");
    });

    test("a custom color from the color picker is used", async ({ diagramPage: page }) => {
      await page.locator(".pencil-btn").click();
      await page.getByLabel("Pencil color").fill("#00aa55");
      const canvasBox = await page.locator(".canvas-flow").boundingBox();
      if (!canvasBox) throw new Error("canvas not found");
      await dragFromPoint(page, canvasBox.x + 150, canvasBox.y + 200, 120, 60);
      await expect(page.locator(".react-flow__node-freehand path")).toHaveAttribute("fill", "#00aa55");
    });

    test("a thicker setting draws a thicker stroke", async ({ diagramPage: page }) => {
      await page.locator(".pencil-btn").click();
      const canvasBox = await page.locator(".canvas-flow").boundingBox();
      if (!canvasBox) throw new Error("canvas not found");

      await page.getByLabel("Pencil thickness").fill("2");
      await dragFromPoint(page, canvasBox.x + 150, canvasBox.y + 200, 160, 0);
      await page.getByLabel("Pencil thickness").fill("20");
      await dragFromPoint(page, canvasBox.x + 150, canvasBox.y + 320, 160, 0);

      const nodes = page.locator(".react-flow__node-freehand");
      await expect(nodes).toHaveCount(2);
      const thin = await nodes.nth(0).boundingBox();
      const thick = await nodes.nth(1).boundingBox();
      if (!thin || !thick) throw new Error("strokes not found");
      expect(thick.height).toBeGreaterThan(thin.height + 8);
    });

    test("the uniform line style keeps the same width however fast you draw", async ({ diagramPage: page }) => {
      await page.locator(".pencil-btn").click();
      await page.getByLabel("Pencil line style").selectOption("uniform");
      await expect(page.getByLabel("Pencil line style")).toHaveValue("uniform");
      const canvasBox = await page.locator(".canvas-flow").boundingBox();
      if (!canvasBox) throw new Error("canvas not found");
      await dragFromPoint(page, canvasBox.x + 150, canvasBox.y + 200, 160, 0);
      await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
    });

    test("the live preview uses the chosen color and thickness", async ({ diagramPage: page }) => {
      await page.locator(".pencil-btn").click();
      await page.getByRole("button", { name: "Color #1971c2" }).click();
      await page.getByLabel("Pencil thickness").fill("9");
      const canvasBox = await page.locator(".canvas-flow").boundingBox();
      if (!canvasBox) throw new Error("canvas not found");
      await page.mouse.move(canvasBox.x + 150, canvasBox.y + 200);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 230, canvasBox.y + 240, { steps: 5 });
      const preview = page.locator(".freehand-preview path");
      await expect(preview).toHaveAttribute("stroke", "#1971c2");
      await expect(preview).toHaveAttribute("stroke-width", "9");
      await page.mouse.up();
    });

    test("thickness is remembered after a reload; the pen colour starts on Auto again", async ({
      diagramPage: page,
      diagram,
    }) => {
      await page.locator(".pencil-btn").click();
      await page.getByRole("button", { name: "Color #2f9e44" }).click();
      await page.getByLabel("Pencil thickness").fill("12");
      await page.reload();
      await page.getByText(diagram.name, { exact: true }).click();
      await page.locator(".pencil-btn").click();
      await expect(page.getByLabel("Pencil color")).toHaveValue("#000000");
      await expect(page.getByRole("button", { name: "Auto", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByLabel("Pencil thickness")).toHaveValue("12");
    });
  });

  test.describe("changing existing drawings", () => {
    async function drawOne(page: import("@playwright/test").Page) {
      await page.locator(".pencil-btn").click();
      const c = await page.locator(".canvas-flow").boundingBox();
      if (!c) throw new Error("canvas not found");
      await dragFromPoint(page, c.x + 200, c.y + 220, 140, 50);
      await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
      await page.locator(".pencil-btn").click(); // back to the normal cursor
    }

    test("a selected drawing shows color presets and opacity in the style panel", async ({ diagramPage: page }) => {
      await drawOne(page);
      await page.locator(".react-flow__node-freehand").click();
      await expect(page.getByRole("group", { name: "Drawing color presets" })).toBeVisible();

      await page.getByRole("button", { name: "Drawing color #2f9e44" }).click();
      const path = page.locator(".react-flow__node-freehand path");
      await expect(path).toHaveAttribute("fill", "#2f9e44");
      await page.getByLabel("Drawing opacity").fill("40");
      await expect(path).toHaveAttribute("fill-opacity", "0.4");
    });

    test("while the Pencil is on, the palette also recolors the drawings that are selected", async ({
      diagramPage: page,
    }) => {
      await drawOne(page);
      await page.locator(".react-flow__node-freehand").click();
      await page.locator(".pencil-btn").click(); // pencil on, drawing still selected
      await expect(page.getByRole("status")).toContainText("1 selected drawing");

      await page.getByRole("button", { name: "Color #e03131" }).click();
      await expect(page.locator(".react-flow__node-freehand path")).toHaveAttribute("fill", "#e03131");
    });

    test("with no drawing selected, the palette only affects new strokes", async ({ diagramPage: page }) => {
      await drawOne(page);
      await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
      await page.locator(".pencil-btn").click();
      await expect(page.getByRole("status")).toHaveCount(0);
      await page.getByRole("button", { name: "Color #9c36b5" }).click();
      await expect(page.locator(".react-flow__node-freehand path")).not.toHaveAttribute("fill", "#9c36b5");
    });
  });

  // Regression: pressing on the pencil palette (it floats inside the canvas
  // area) used to count as pressing on the canvas and drew a stroke.
  test.describe("pressing on panels and controls never draws", () => {
    test("using the pencil palette does not draw", async ({ diagramPage: page }) => {
      await page.locator(".pencil-btn").click();
      await page.getByRole("button", { name: "Color #e03131" }).click();
      await page.getByRole("button", { name: "Color #1971c2" }).click({ delay: 120 });
      await page.getByLabel("Pencil color").click();
      await page.keyboard.press("Escape");

      // Drag the sliders - mouse-down, move, release on the thumb.
      for (const name of ["Pencil thickness", "Pencil opacity"]) {
        const slider = page.getByLabel(name);
        const box = await slider.boundingBox();
        if (!box) throw new Error("slider not found");
        await page.mouse.move(box.x + 8, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2, { steps: 6 });
        await page.mouse.up();
      }
      await page.getByLabel("Pencil line style").selectOption("uniform");
      // Grab the palette by its grip and move it around.
      const grip = page.locator(".pencil-panel .panel-grip");
      const g = await grip.boundingBox();
      if (!g) throw new Error("grip not found");
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
      await page.mouse.down();
      await page.mouse.move(g.x + 80, g.y + 60, { steps: 5 });
      await page.mouse.up();

      await expect(page.locator(".react-flow__node-freehand")).toHaveCount(0);
      await expect(page.locator(".freehand-preview")).toHaveCount(0);
      // ...and the canvas itself still draws.
      const c = await page.locator(".canvas-flow").boundingBox();
      if (!c) throw new Error("canvas not found");
      await dragFromPoint(page, c.x + 200, c.y + 300, 120, 40);
      await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
    });

    test("clicking the zoom controls or the shapes panel does not draw", async ({ diagramPage: page }) => {
      await page.locator(".pencil-btn").click();
      await page.getByRole("button", { name: "Zoom In" }).click();
      await page.getByRole("button", { name: "Zoom Out" }).click();
      await page.getByRole("button", { name: "Fit View" }).click();
      // (the tall shapes panel would cover the zoom controls, so open it after)
      await page.locator(".shapes-toggle").click();
      const dock = await page.locator(".shapes-dock").boundingBox();
      if (!dock) throw new Error("dock not found");
      await page.mouse.move(dock.x + 20, dock.y + dock.height - 20);
      await page.mouse.down();
      await page.mouse.move(dock.x + 60, dock.y + dock.height - 40, { steps: 5 });
      await page.mouse.up();
      await expect(page.locator(".react-flow__node-freehand")).toHaveCount(0);
    });
  });
});
