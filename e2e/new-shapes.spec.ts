// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

test.describe("Additional shape coverage", () => {
  test("Preparation (hexagon) shape can be added, styled, and follows the widget pattern", async ({
    diagramPage: page,
  }) => {
    const node = await addWidget(page, "Preparation");
    await node.click();
    await expect(page.locator(".style-panel")).toBeVisible();
    await page.locator(".style-panel input[type='color']").first().fill("#00ff00");
    await expect(node.locator(".shape-node")).toHaveCSS("background-color", "rgb(0, 255, 0)");
  });

  test("Manual Operation (trapezoid) shape can be added, styled, and follows the widget pattern", async ({
    diagramPage: page,
  }) => {
    const node = await addWidget(page, "Manual Operation");
    await node.click();
    await expect(page.locator(".style-panel")).toBeVisible();
    await page.locator(".style-panel input[type='color']").first().fill("#ff00ff");
    await expect(node.locator(".shape-node")).toHaveCSS("background-color", "rgb(255, 0, 255)");
  });
});
