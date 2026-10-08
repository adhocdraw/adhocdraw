// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

const SETTLE_MS = 700;

test.describe("Diagram version history", () => {
  test("Save version adds an entry to the history panel", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await page.getByRole("button", { name: "History" }).click();
    await expect(page.locator(".version-empty")).toBeVisible();

    await page.getByRole("button", { name: "Save version" }).click();
    await expect(page.locator(".version-list li")).toHaveCount(1);
    await expect(page.getByText("Manual save")).toBeVisible();
  });

  test("the version list persists across a reload", async ({ diagramPage: page, diagram }) => {
    await addWidget(page, "Process");
    await page.getByRole("button", { name: "History" }).click();
    await page.getByRole("button", { name: "Save version" }).click();
    await expect(page.locator(".version-list li")).toHaveCount(1);

    await page.goto("/");
    await page.getByText(diagram.name, { exact: true }).click();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.locator(".version-list li")).toHaveCount(1);
  });

  test("restoring a version asks for confirmation, replaces the canvas, and is itself undoable", async ({
    diagramPage: page,
  }) => {
    const node = await addWidget(page, "Process");
    await page.waitForTimeout(SETTLE_MS);

    await page.getByRole("button", { name: "History" }).click();
    await page.getByRole("button", { name: "Save version" }).click();
    await expect(page.locator(".version-list li")).toHaveCount(1);
    await page.locator(".shortcuts-close").click();

    // Delete the node after the version was saved.
    await node.click();
    await page.keyboard.press("Delete");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);

    await page.getByRole("button", { name: "History" }).click();
    await page.getByRole("button", { name: "Restore" }).first().click();
    await page.locator(".confirm-dialog").getByRole("button", { name: "Restore" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // The restore itself is undoable.
    await page.keyboard.press("Control+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });

  test("restoring is cancelled if the confirmation is dismissed", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    await page.waitForTimeout(SETTLE_MS);
    await page.getByRole("button", { name: "History" }).click();
    await page.getByRole("button", { name: "Save version" }).click();
    await expect(page.locator(".version-list li")).toHaveCount(1);

    await page.getByRole("button", { name: "Restore" }).first().click();
    await page.locator(".confirm-dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator(".confirm-dialog")).toHaveCount(0);
    await expect(page.locator(".version-history-panel")).toBeVisible();
  });
});
