// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, deselectAll, settleLayout, spreadNodes } from "./helpers";

test.describe("Select mode", () => {
  test("toggles on/off via the Select button", async ({ diagramPage: page }) => {
    const selectBtn = page.locator(".select-mode-btn");
    await selectBtn.click();
    await expect(selectBtn).toHaveClass(/active/);

    await selectBtn.click();
    await expect(selectBtn).not.toHaveClass(/active/);
  });

  test("Escape exits select mode", async ({ diagramPage: page }) => {
    const selectBtn = page.locator(".select-mode-btn");
    await selectBtn.click();
    await expect(selectBtn).toHaveClass(/active/);

    await page.keyboard.press("Escape");
    await expect(selectBtn).not.toHaveClass(/active/);
  });

  test("Select and Pencil are mutually exclusive", async ({ diagramPage: page }) => {
    const selectBtn = page.locator(".select-mode-btn");
    const pencilBtn = page.locator(".pencil-btn");
    await selectBtn.click();
    await expect(selectBtn).toHaveClass(/active/);

    await pencilBtn.click();
    await expect(pencilBtn).toHaveClass(/active/);
    await expect(selectBtn).not.toHaveClass(/active/);

    await selectBtn.click();
    await expect(selectBtn).toHaveClass(/active/);
    await expect(pencilBtn).not.toHaveClass(/active/);
  });

  test("a plain click-drag box-selects multiple nodes while active, without needing Shift", async ({
    diagramPage: page,
  }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await page.locator(".select-mode-btn").click();

    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    // Drag a box around both nodes from a corner of empty canvas space,
    // with no Shift key held.
    await page.mouse.move(canvasBox.x + 10, canvasBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width - 10, canvasBox.y + canvasBox.height - 10, { steps: 10 });
    await page.mouse.up();

    await expect(a).toHaveClass(/selected/);
    await expect(b).toHaveClass(/selected/);
  });

  test("dragging a node directly still moves it while select mode is active", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await settleLayout(page);
    await page.locator(".select-mode-btn").click();

    const before = await node.boundingBox();
    if (!before) throw new Error("node not found");
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 120, before.y + before.height / 2 + 80, { steps: 10 });
    await page.mouse.up();

    const after = await node.boundingBox();
    if (!after) throw new Error("node not found after drag");
    expect(after.x).toBeGreaterThan(before.x + 90);
    expect(after.y).toBeGreaterThan(before.y + 60);
  });

  test("without select mode, a plain click-drag on empty canvas pans instead of selecting", async ({
    diagramPage: page,
  }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    // spreadNodes repositions each node by dragging it directly, which
    // (correctly) selects the last-dragged node as a side effect of that
    // drag - clear that leftover selection so the assertions below verify
    // the upcoming pane drag itself, not setup residue.
    await deselectAll(page);

    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    await page.mouse.move(canvasBox.x + 10, canvasBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width - 10, canvasBox.y + canvasBox.height - 10, { steps: 10 });
    await page.mouse.up();

    await expect(a).not.toHaveClass(/selected/);
    await expect(b).not.toHaveClass(/selected/);
  });
});
