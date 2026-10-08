// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

const LONG_TEXT = "Line1\nLine2\nLine3\nLine4\nLine5\nLine6\nLine7";

async function typeMultilineText(page: import("@playwright/test").Page, node: import("@playwright/test").Locator) {
  await node.dblclick();
  const textarea = page.locator(".shape-node-textarea");
  await textarea.fill(LONG_TEXT);
  // Blur commits the text (onBlur handler) - clicking empty canvas away
  // from the node does that without disturbing its position.
  await page.mouse.click(20, 20);
}

test.describe("Shape text overflow", () => {
  test("a Cloud shape's icon keeps its regular size and the node grows to show all the typed text", async ({
    diagramPage: page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const node = await addWidget(page, "Cloud");
    const beforeHeight = await node.evaluate((el) => (el as HTMLElement).getBoundingClientRect().height);
    await typeMultilineText(page, node);
    // Give the height-measuring effect a moment to settle (and, if it were
    // looping, a moment to crash) before asserting anything.
    await page.waitForTimeout(300);

    const nodeBox = await node.boundingBox();
    const iconBox = await node.locator(".shape-svg").boundingBox();
    const labelBox = await node.locator(".shape-node-svg-label").boundingBox();
    if (!nodeBox || !iconBox || !labelBox) throw new Error("box not found");

    // The node grew to fit all 7 lines instead of squeezing the icon or
    // clipping/scrolling the text.
    expect(nodeBox.height).toBeGreaterThan(beforeHeight * 1.5);
    expect(iconBox.height).toBeGreaterThan(15); // screen px: 24px min x 0.8 zoom
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(nodeBox.y + nodeBox.height + 1);
    expect(pageErrors).toEqual([]);
  });

  test("a Server shape's icon keeps its regular size and the node grows to show all the typed text", async ({
    diagramPage: page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const node = await addWidget(page, "Server");
    const beforeHeight = await node.evaluate((el) => (el as HTMLElement).getBoundingClientRect().height);
    await typeMultilineText(page, node);
    await page.waitForTimeout(300);

    const nodeBox = await node.boundingBox();
    const iconBox = await node.locator(".shape-svg").boundingBox();
    const labelBox = await node.locator(".shape-node-svg-label").boundingBox();
    if (!nodeBox || !iconBox || !labelBox) throw new Error("box not found");

    expect(nodeBox.height).toBeGreaterThan(beforeHeight * 1.5);
    expect(iconBox.height).toBeGreaterThan(15); // screen px: 24px min x 0.8 zoom
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(nodeBox.y + nodeBox.height + 1);
    expect(pageErrors).toEqual([]);
  });

  test("a CSS-drawn shape (Process) grows to show all the typed text instead of clipping or spilling past its border", async ({
    diagramPage: page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const node = await addWidget(page, "Process");
    const beforeHeight = await node.evaluate((el) => (el as HTMLElement).getBoundingClientRect().height);
    await typeMultilineText(page, node);
    await page.waitForTimeout(300);

    const nodeBox = await node.boundingBox();
    const textBox = await node.locator(".shape-node-text").boundingBox();
    if (!nodeBox || !textBox) throw new Error("box not found");

    expect(nodeBox.height).toBeGreaterThan(beforeHeight * 1.5);
    expect(textBox.y).toBeGreaterThanOrEqual(nodeBox.y - 1);
    expect(textBox.y + textBox.height).toBeLessThanOrEqual(nodeBox.y + nodeBox.height + 1);
    expect(pageErrors).toEqual([]);
  });

  test("a shape with short text does not grow beyond its normal default size", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    await page.waitForTimeout(300);
    const height = await node.evaluate((el) => parseInt((el as HTMLElement).style.height, 10));
    expect(height).toBeLessThan(80);
  });
});
