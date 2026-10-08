// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

const SHAPE_LABELS = [
  "Sticky Note",
  "Text",
  "Frame",
  "Process",
  "Decision",
  "Start / End",
  "Input / Output",
  "Ellipse",
  "Document",
  "Database",
  "Cloud",
  "Server",
  "Actor / User",
];

test.describe("Adding widgets", () => {
  for (const label of SHAPE_LABELS) {
    test(`adds a ${label} widget to the canvas`, async ({ diagramPage: page }) => {
      await addWidget(page, label);
    });
  }

  test("edits sticky note text and color", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Sticky Note");
    await node.dblclick();
    const textarea = node.locator(".sticky-note-textarea");
    await textarea.fill("Brainstorm idea");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(node.locator(".sticky-note-text")).toHaveText("Brainstorm idea");

    const secondSwatch = node.locator(".swatch").nth(1);
    const color = await secondSwatch.evaluate((el) => (el as HTMLElement).style.background);
    await secondSwatch.click();
    await expect(node.locator(".sticky-note")).toHaveCSS("background-color", await toRgb(page, color));
  });

  test("edits process (shape) text", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.dblclick();
    await node.locator(".shape-node-textarea").fill("Validate input");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(node.locator(".shape-node-text")).toHaveText("Validate input");
  });

  test("edits text widget content", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Text");
    await node.dblclick();
    await node.locator(".text-node-textarea").fill("Label");
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(node.locator(".text-node-text")).toHaveText("Label");
  });
});

async function toRgb(page: import("@playwright/test").Page, cssColor: string) {
  return page.evaluate((c) => {
    const el = document.createElement("div");
    el.style.color = c;
    document.body.appendChild(el);
    const rgb = getComputedStyle(el).color;
    document.body.removeChild(el);
    return rgb;
  }, cssColor);
}
