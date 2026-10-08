// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, openDiagram } from "./helpers";

test.describe("Hyperlinks on shapes", () => {
  test("Add Link attaches a URL and shows a link badge", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Add Link" }).click();

    await expect(page.locator(".link-popover")).toBeVisible();
    await page.locator(".link-popover input[type='text']").fill("https://example.com");
    await page.locator(".link-popover-actions button", { hasText: "Done" }).click();

    await expect(page.locator(".link-badge")).toBeVisible();
    await expect(page.locator(".link-popover")).toHaveCount(0);
  });

  test("clicking the link badge opens an external URL in a new tab", async ({ diagramPage: page, context }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Add Link" }).click();
    await page.locator(".link-popover input[type='text']").fill("https://example.com/");
    await page.locator(".link-popover-actions button", { hasText: "Done" }).click();

    const [popup] = await Promise.all([context.waitForEvent("page"), page.locator(".link-badge").click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe("https://example.com/");
    await popup.close();
  });

  test("a page link switches the active page tab", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await page.locator(".page-tab-add").click();
    await expect(page.locator(".page-tab")).toHaveCount(2);
    // Adding a page switches to it; switch back to page 1 where the node is.
    await page.locator(".page-tab").first().locator("span").click();

    // Wire the node's link to page 2 (the second <option>, since the
    // dropdown lists pages in tab order) and confirm clicking the badge
    // switches the active tab.
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Add Link" }).click();
    await page.locator(".link-popover label", { hasText: "Page" }).locator("input").click();
    await page.locator(".link-popover select").selectOption({ index: 1 });
    await page.locator(".link-popover-actions button", { hasText: "Done" }).click();

    await page.locator(".link-badge").click();
    await expect(page.locator(".page-tab.active")).toHaveText(/Page 2/);
  });

  test("Remove link clears the link and badge", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Add Link" }).click();
    await page.locator(".link-popover input[type='text']").fill("https://example.com");
    await page.locator(".link-popover-actions button", { hasText: "Done" }).click();
    await expect(page.locator(".link-badge")).toBeVisible();

    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Edit Link" }).click();
    await page.locator(".link-popover-actions button", { hasText: "Remove link" }).click();

    await expect(page.locator(".link-badge")).toHaveCount(0);
  });

  test("link persists through reload", async ({ diagramPage: page, diagram }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Add Link" }).click();
    await page.locator(".link-popover input[type='text']").fill("https://example.com");
    await page.locator(".link-popover-actions button", { hasText: "Done" }).click();
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await expect(page.locator(".link-badge")).toBeVisible();
  });
});
