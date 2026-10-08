// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragHandle, openDiagram, settleLayout, spreadNodes } from "./helpers";

test.describe("UML class shape", () => {
  test("adds a class with independently editable name, attributes, and methods sections", async ({
    diagramPage: page,
  }) => {
    const uml = await addWidget(page, "UML Class");
    await expect(uml.locator(".uml-node-title")).toBeVisible();
    await expect(uml.locator(".uml-node-attributes")).toBeVisible();
    await expect(uml.locator(".uml-node-methods")).toBeVisible();

    await uml.locator(".uml-node-title").dblclick();
    await uml.locator(".uml-node-textarea").fill("Customer");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(uml.locator(".uml-node-title")).toHaveText("Customer");

    await uml.locator(".uml-node-attributes").dblclick();
    await uml.locator(".uml-node-textarea").fill("+ id: int");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(uml.locator(".uml-node-attributes")).toHaveText("+ id: int");
    // Editing attributes must not touch the title or methods sections.
    await expect(uml.locator(".uml-node-title")).toHaveText("Customer");
    await expect(uml.locator(".uml-node-methods")).toHaveText("+ method(): ReturnType");
  });

  test("UML class content persists through reload", async ({ diagramPage: page, diagram }) => {
    const uml = await addWidget(page, "UML Class");
    await uml.locator(".uml-node-title").dblclick();
    await uml.locator(".uml-node-textarea").fill("Order");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await expect(page.locator(".uml-node-title")).toHaveText("Order");
  });
});

test.describe("ER crow's-foot connectors", () => {
  test("Start and End marker selectors offer crow's-foot options", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await dragHandle(page, a, "right", b, "left");

    await page.locator(".react-flow__edge").click();
    const startSelect = page.locator(".edge-style-panel label", { hasText: "Start" }).locator("select");
    const endSelect = page.locator(".edge-style-panel label", { hasText: "End" }).locator("select");
    await expect(startSelect).toHaveValue("none");
    await expect(endSelect).toHaveValue("arrowclosed");

    await expect(startSelect.locator("option", { hasText: "Crow's foot: many" })).toHaveCount(1);
    await expect(endSelect.locator("option", { hasText: "Crow's foot: one" })).toHaveCount(1);
  });

  test("selecting crow's-foot markers renders them on both ends of the edge", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await dragHandle(page, a, "right", b, "left");

    await page.locator(".react-flow__edge").click();
    await page.locator(".edge-style-panel label", { hasText: "Start" }).locator("select").selectOption("crow-many");
    await page.locator(".edge-style-panel label", { hasText: "End" }).locator("select").selectOption("crow-one");

    const edgePath = page.locator(".react-flow__edge-path").first();
    await expect(edgePath).toHaveAttribute("marker-start", /adhocdraw-crow-many/);
    await expect(edgePath).toHaveAttribute("marker-end", /adhocdraw-crow-one/);
  });

  test("crow's-foot marker choice persists through reload", async ({ diagramPage: page, diagram }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await dragHandle(page, a, "right", b, "left");

    await page.locator(".react-flow__edge").click();
    await page.locator(".edge-style-panel label", { hasText: "Start" }).locator("select").selectOption("crow-zero-many");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await page.locator(".react-flow__edge").click({ force: true });
    await expect(page.locator(".edge-style-panel label", { hasText: "Start" }).locator("select")).toHaveValue(
      "crow-zero-many"
    );
  });
});
