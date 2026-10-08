// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, deselectAll, settleLayout, spreadNodes } from "./helpers";

async function setShapeText(page: import("@playwright/test").Page, node: import("@playwright/test").Locator, text: string) {
  await node.dblclick();
  await node.locator(".shape-node-textarea").fill(text);
  await deselectAll(page);
}

test.describe("Find & Replace", () => {
  test("Ctrl+F opens the find panel; Escape and the close button close it", async ({ diagramPage: page }) => {
    await expect(page.locator(".find-replace-panel")).toHaveCount(0);
    await page.keyboard.press("Control+f");
    await expect(page.locator(".find-replace-panel")).toBeVisible();

    // The search input auto-focuses, so the global Ctrl+F shortcut (which
    // ignores keystrokes typed into inputs, to avoid hijacking typing) can't
    // be used to close it again - Escape and the panel's own close button
    // are the ways out while focus is inside the field.
    await page.keyboard.press("Escape");
    await expect(page.locator(".find-replace-panel")).toHaveCount(0);

    await page.keyboard.press("Control+f");
    await expect(page.locator(".find-replace-panel")).toBeVisible();
    await page.locator(".find-replace-close").click();
    await expect(page.locator(".find-replace-panel")).toHaveCount(0);
  });

  test("typing a query reports and selects matches across nodes", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await setShapeText(page, a, "Alpha Task");
    await setShapeText(page, b, "Beta Task");

    await page.keyboard.press("Control+f");
    await page.locator(".find-replace-panel input").first().fill("Task");
    await expect(page.locator(".find-replace-count")).toHaveText("1/2");

    await page.locator('.find-replace-panel button[title="Next match"]').click();
    await expect(page.locator(".find-replace-count")).toHaveText("2/2");
    await expect(b).toHaveClass(/selected/);
  });

  test("Replace All updates every matching node", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await setShapeText(page, a, "Alpha Task");
    await setShapeText(page, b, "Beta Task");

    await page.keyboard.press("Control+f");
    await page.locator(".find-replace-panel input").first().fill("Task");
    await page.locator(".find-replace-panel input").nth(1).fill("Job");
    await page.getByRole("button", { name: "Replace All" }).click();

    await expect(a.locator(".shape-node-text")).toHaveText("Alpha Job");
    await expect(b.locator(".shape-node-text")).toHaveText("Beta Job");
    await expect(page.locator(".find-replace-count")).toHaveText("0/0");
  });

  test("Replace updates only the current match", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await setShapeText(page, a, "Alpha Task");
    await setShapeText(page, b, "Beta Task");

    await page.keyboard.press("Control+f");
    await page.locator(".find-replace-panel input").first().fill("Task");
    await page.locator(".find-replace-panel input").nth(1).fill("Job");
    await expect(page.locator(".find-replace-count")).toHaveText("1/2");
    await page.getByRole("button", { name: "Replace", exact: true }).click();

    await expect(a.locator(".shape-node-text")).toHaveText("Alpha Job");
    await expect(b.locator(".shape-node-text")).toHaveText("Beta Task");
  });
});
