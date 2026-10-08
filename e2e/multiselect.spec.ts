// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragNodeTo, marqueeSelect, settleLayout, spreadNodes } from "./helpers";

test.describe("Multi-select", () => {
  test("marquee-drag selects multiple nodes and shows a selection outline", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Sticky Note");
    const b = await addWidget(page, "Text");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await marqueeSelect(page, [a, b]);

    await expect(a).toHaveClass(/selected/);
    await expect(b).toHaveClass(/selected/);
  });

  test("deletes every selected node in one action", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Sticky Note");
    const b = await addWidget(page, "Text");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await marqueeSelect(page, [a, b]);
    await page.keyboard.press("Backspace");

    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });

  test("moving one selected node drags the whole selection together", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Sticky Note");
    const b = await addWidget(page, "Text");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);

    await marqueeSelect(page, [a, b]);

    const aBoxBefore = await a.boundingBox();
    const bBoxBefore = await b.boundingBox();
    if (!aBoxBefore || !bBoxBefore) throw new Error("nodes not found");

    await dragNodeTo(page, b, bBoxBefore.x + bBoxBefore.width / 2 + 100, bBoxBefore.y + bBoxBefore.height / 2 + 60);

    const aBoxAfter = await a.boundingBox();
    if (!aBoxAfter) throw new Error("node a not found after drag");
    expect(aBoxAfter.x).toBeGreaterThan(aBoxBefore.x + 70);
    expect(aBoxAfter.y).toBeGreaterThan(aBoxBefore.y + 30);
  });
});
