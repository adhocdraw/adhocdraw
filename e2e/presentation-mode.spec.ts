// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

test.describe("Presentation mode", () => {
  test("Present hides editor chrome and shows exit/navigation controls", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");

    await page.getByRole("button", { name: "Present", exact: true }).click();

    await expect(page.locator(".canvas-header")).toBeHidden();
    await expect(page.locator(".page-tabs")).toBeHidden();
    await expect(page.locator(".presentation-controls")).toBeVisible();
    await expect(page.locator(".presentation-page-indicator")).toHaveText("1 / 1");
  });

  test("Next/Prev step through pages, disabled at the ends", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    await page.locator(".page-tab-add").click();
    await expect(page.locator(".page-tab")).toHaveCount(2);

    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(page.locator(".presentation-page-indicator")).toHaveText("2 / 2");
    await expect(page.locator(".presentation-controls button", { hasText: "Next" })).toBeDisabled();

    await page.locator(".presentation-controls button", { hasText: "Prev" }).click();
    await expect(page.locator(".presentation-page-indicator")).toHaveText("1 / 2");
    await expect(page.locator(".presentation-controls button", { hasText: "Prev" })).toBeDisabled();

    await page.locator(".presentation-controls button", { hasText: "Next" }).click();
    await expect(page.locator(".presentation-page-indicator")).toHaveText("2 / 2");
  });

  test("arrow keys navigate pages while presenting", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    await page.locator(".page-tab-add").click();
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(page.locator(".presentation-page-indicator")).toHaveText("2 / 2");

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".presentation-page-indicator")).toHaveText("1 / 2");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".presentation-page-indicator")).toHaveText("2 / 2");
  });

  test("Escape and the exit button both return to normal editing with state intact", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.dblclick();
    await node.locator(".shape-node-textarea").fill("Keep me");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

    await page.getByRole("button", { name: "Present", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".canvas-header")).toBeVisible();
    await expect(node.locator(".shape-node-text")).toHaveText("Keep me");

    await page.getByRole("button", { name: "Present", exact: true }).click();
    await page.locator(".presentation-exit").click();
    await expect(page.locator(".canvas-header")).toBeVisible();
  });

  test("an Exit button at the top right leaves presentation mode (as does the bottom one)", async ({ diagramPage: page }) => {
    await page.getByRole("button", { name: "Present", exact: true }).click();
    const top = page.getByRole("button", { name: "Exit presentation" });
    await expect(top).toBeVisible();
    const flow = (await page.locator(".canvas-flow").boundingBox())!;
    const b = (await top.boundingBox())!;
    expect(b.y - flow.y).toBeLessThan(40); // at the top
    expect(flow.x + flow.width - (b.x + b.width)).toBeLessThan(40); // at the right
    await top.click();
    await expect(page.locator(".presentation-controls")).toHaveCount(0);
    await expect(top).toHaveCount(0);
    await expect(page.locator(".canvas-header")).toBeVisible();
  });
});
