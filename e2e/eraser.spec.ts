// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { createDiagramFromMenu, dragFromPoint, addWidget } from "./helpers";

test.describe("Eraser", () => {
  test("E turns the eraser on (and the pencil off); dragging over a drawing removes just that drawing; undo brings it back", async ({
    page,
  }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `er-${Date.now()}`, "White Board");
    const c = (await page.locator(".canvas-flow").boundingBox())!;
    // Two strokes far apart.
    await dragFromPoint(page, c.x + 200, c.y + 250, 140, 60);
    await dragFromPoint(page, c.x + 520, c.y + 420, 140, 60);
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(2);

    // Let the two strokes settle into the undo history before erasing (rapid changes are one undo step).
    await page.waitForTimeout(900);
    await page.keyboard.press("e");
    await expect(page.locator(".eraser-btn")).toHaveClass(/active/);
    await expect(page.locator(".pencil-btn")).not.toHaveClass(/active/);

    // Along the first stroke.
    await dragFromPoint(page, c.x + 190, c.y + 244, 160, 72);
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);

    // Through empty space: nothing is removed, and no new drawing is made.
    await dragFromPoint(page, c.x + 200, c.y + 120, 250, 0);
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);

    // Undo (Ctrl/Cmd+Z) brings the erased drawing back.
    await page.waitForTimeout(900);
    await page.keyboard.press("Control+z");
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(2);

    await page.keyboard.press("Escape");
    await expect(page.locator(".eraser-btn")).not.toHaveClass(/active/);
  });

  test("it only removes drawings, not shapes, and the tools panel has it", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `er-${Date.now()}`, "White Board");
    const shape = await addWidget(page, "Process");
    const box = (await shape.boundingBox())!;
    await page.getByRole("button", { name: "Eraser" }).first().click();
    await expect(page.getByRole("group", { name: "Tool panel" }).getByRole("button", { name: "Eraser" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await dragFromPoint(page, box.x - 10, box.y + box.height / 2, box.width + 20, 0);
    await expect(page.locator(".react-flow__node-shape")).toHaveCount(1);
  });

  test("the toolbar's Draw group has the Eraser button too (and the shortcut is listed)", async ({ diagramPage: page }) => {
    await expect(page.locator(".eraser-btn")).toHaveAttribute("aria-label", "Eraser");
    await page.locator(".eraser-btn").click();
    await expect(page.locator(".eraser-btn")).toHaveClass(/active/);
    await page.locator(".eraser-btn").click();
    await expect(page.locator(".eraser-btn")).not.toHaveClass(/active/);
    await page.keyboard.press("?");
    await expect(page.locator(".shortcuts-list")).toContainText("Eraser");
  });
});
