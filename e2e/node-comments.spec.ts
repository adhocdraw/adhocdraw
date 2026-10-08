// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

test.describe("Node comments / sticky annotations", () => {
  test("Add Note creates a comment popover and a persistent badge", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Add Note" }).click();

    await expect(page.locator(".comment-popover textarea")).toBeVisible();
    await page.locator(".comment-popover textarea").fill("Ping design about this state.");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

    await expect(page.locator(".comment-badge")).toBeVisible();
    await expect(page.locator(".comment-popover")).toHaveCount(0);
  });

  test("clicking the badge reopens the note for editing, labeled Edit Note in the menu", async ({
    diagramPage: page,
  }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Add Note" }).click();
    await page.locator(".comment-popover textarea").fill("First note");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

    await page.locator(".comment-badge").click();
    await expect(page.locator(".comment-popover textarea")).toHaveValue("First note");
    await page.locator(".comment-popover textarea").fill("Updated note");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

    await node.click({ button: "right" });
    await expect(page.locator(".context-menu").getByRole("menuitem", { name: "Edit Note" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.locator(".comment-badge").click();
    await expect(page.locator(".comment-popover textarea")).toHaveValue("Updated note");
  });

  test("a note doesn't interfere with the node's own text", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.dblclick();
    await node.locator(".shape-node-textarea").fill("Node label");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Add Note" }).click();
    await page.locator(".comment-popover textarea").fill("A separate note");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

    await expect(node.locator(".shape-node-text")).toHaveText("Node label");
  });

  test("note persists through reload", async ({ diagramPage: page, diagram }) => {
    const node = await addWidget(page, "Process");
    await node.click({ button: "right" });
    await page.locator(".context-menu").getByRole("menuitem", { name: "Add Note" }).click();
    await page.locator(".comment-popover textarea").fill("Persisted note");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await page.goto("/");
    await page.getByText(diagram.name, { exact: true }).click();
    await expect(page.locator(".comment-badge")).toBeVisible();
    await page.locator(".comment-badge").click();
    await expect(page.locator(".comment-popover textarea")).toHaveValue("Persisted note");
  });
});
