// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, openDiagram } from "./helpers";

test.describe("Table shape", () => {
  test("adds a 2x2 table by default", async ({ diagramPage: page }) => {
    const table = await addWidget(page, "Table");
    await expect(table.locator(".table-node-cell")).toHaveCount(4);
  });

  test("+ Row / + Col grow the grid, - Row / - Col shrink it", async ({ diagramPage: page }) => {
    const table = await addWidget(page, "Table");
    await table.click();

    await table.locator(".table-node-controls button", { hasText: "+ Row" }).click();
    await expect(table.locator(".table-node-cell")).toHaveCount(6);
    await table.locator(".table-node-controls button", { hasText: "+ Col" }).click();
    await expect(table.locator(".table-node-cell")).toHaveCount(9);

    await table.locator(".table-node-controls button", { hasText: "- Row" }).click();
    await expect(table.locator(".table-node-cell")).toHaveCount(6);
    await table.locator(".table-node-controls button", { hasText: "- Col" }).click();
    await expect(table.locator(".table-node-cell")).toHaveCount(4);
  });

  test("double-clicking a cell edits it independently of the others", async ({ diagramPage: page }) => {
    const table = await addWidget(page, "Table");
    const cells = table.locator(".table-node-cell");

    await cells.nth(0).dblclick();
    await table.locator(".table-node-cell-input").fill("Name");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

    await cells.nth(3).dblclick();
    await table.locator(".table-node-cell-input").fill("Age");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

    await expect(cells.nth(0)).toHaveText("Name");
    await expect(cells.nth(3)).toHaveText("Age");
    await expect(cells.nth(1)).toHaveText("");
  });

  test("table content persists through reload", async ({ diagramPage: page, diagram }) => {
    const table = await addWidget(page, "Table");
    await table.locator(".table-node-cell").first().dblclick();
    await table.locator(".table-node-cell-input").fill("Header");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await expect(page.locator(".table-node-cell").first()).toHaveText("Header");
  });
});
