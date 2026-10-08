// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, openDiagram } from "./helpers";

test.describe("Custom data fields and conditional formatting", () => {
  test("Edit Data adds and edits key/value fields", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Edit Data" }).click();

    await page.locator(".data-panel-add-field").click();
    await page.locator(".data-panel-field-row input").first().fill("owner");
    await page.locator(".data-panel-field-row input").nth(1).fill("infra team");

    await expect(page.locator(".data-panel-field-row input").first()).toHaveValue("owner");
    await expect(page.locator(".data-panel-field-row input").nth(1)).toHaveValue("infra team");
  });

  test("a matching conditional formatting rule recolors the node, and stops when it no longer matches", async ({
    diagramPage: page,
  }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Edit Data" }).click();

    await page.locator(".data-panel-add-field").click();
    await page.locator(".data-panel-field-row input").first().fill("status");
    await page.locator(".data-panel-field-row input").nth(1).fill("urgent");

    const defaultColor = await node.locator(".shape-node").evaluate((el) => getComputedStyle(el).backgroundColor);

    await page.locator(".data-panel-rule-row input").first().fill("status");
    await page.locator(".data-panel-rule-row input").nth(1).fill("urgent");
    const ruledColor = await node.locator(".shape-node").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(ruledColor).not.toBe(defaultColor);

    // Change the field's value so it no longer matches the rule.
    await page.locator(".data-panel-field-row input").nth(1).fill("low");
    const revertedColor = await node.locator(".shape-node").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(revertedColor).toBe(defaultColor);
  });

  test("Clear rule removes the conditional formatting", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Edit Data" }).click();

    await page.locator(".data-panel-add-field").click();
    await page.locator(".data-panel-field-row input").first().fill("status");
    await page.locator(".data-panel-field-row input").nth(1).fill("urgent");
    await page.locator(".data-panel-rule-row input").first().fill("status");
    await page.locator(".data-panel-rule-row input").nth(1).fill("urgent");

    await expect(page.locator(".data-panel-clear-rule")).toBeVisible();
    await page.locator(".data-panel-clear-rule").click();
    await expect(page.locator(".data-panel-clear-rule")).toHaveCount(0);
  });

  test("custom fields and the formatting rule persist through reload", async ({ diagramPage: page, diagram }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Edit Data" }).click();
    await page.locator(".data-panel-add-field").click();
    await page.locator(".data-panel-field-row input").first().fill("status");
    await page.locator(".data-panel-field-row input").nth(1).fill("urgent");
    await page.locator(".data-panel-rule-row input").first().fill("status");
    await page.locator(".data-panel-rule-row input").nth(1).fill("urgent");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Edit Data" }).click();
    await expect(page.locator(".data-panel-field-row input").first()).toHaveValue("status");
    await expect(page.locator(".data-panel-rule-row input").first()).toHaveValue("status");
  });
});
