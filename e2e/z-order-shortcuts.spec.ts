// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, deselectAll, openDiagram, settleLayout, spreadNodes } from "./helpers";

test.describe("Node z-order keyboard shortcuts", () => {
  test("] brings the selected node to front, [ sends it to back", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await b.click();
    await page.keyboard.press("]");
    await deselectAll(page);
    let zA = await a.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    let zB = await b.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    expect(zB).toBeGreaterThan(zA);

    await b.click();
    await page.keyboard.press("[");
    await deselectAll(page);
    zA = await a.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    zB = await b.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    expect(zB).toBeLessThan(zA);
  });

  test("z-order change persists through reload", async ({ diagramPage: page, diagram }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Decision");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await b.click();
    await page.keyboard.press("[");
    await deselectAll(page);
    const zA = await a.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    const zB = await b.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    expect(zB).toBeLessThan(zA);
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    const zA2 = await a.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    const zB2 = await b.evaluate((el) => Number((el as HTMLElement).style.zIndex || 0));
    expect(zB2).toBeLessThan(zA2);
  });

  test("] / [ are ignored while typing inside a node's text field", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await node.dblclick();
    await node.locator(".shape-node-textarea").fill("a]b[c");
    await expect(node.locator(".shape-node-textarea")).toHaveValue("a]b[c");
  });
});
