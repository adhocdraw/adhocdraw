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
  for (const kind of ["Cloud", "Database", "Document"]) {
    test(`a ${kind} shape keeps its size however much text is typed, and the text stays inside it`, async ({
      diagramPage: page,
    }) => {
      const pageErrors: Error[] = [];
      page.on("pageerror", (err) => pageErrors.push(err));

      const node = await addWidget(page, kind);
      const before = await node.boundingBox();
      await typeMultilineText(page, node);
      await page.waitForTimeout(300); // (and, if the height effect were looping, time to crash)

      const after = await node.boundingBox();
      const labelBox = await node.locator(".shape-node-svg-label").boundingBox();
      if (!before || !after || !labelBox) throw new Error("box not found");
      expect(after.height).toBeCloseTo(before.height, 0);
      expect(after.width).toBeCloseTo(before.width, 0);
      expect(labelBox.y).toBeGreaterThanOrEqual(after.y - 1);
      expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(after.y + after.height + 1);
      expect(pageErrors).toEqual([]);
    });
  }

  for (const kind of ["Server", "Actor / User"]) {
    test(`a ${kind} shape keeps its size however much text is typed; the label hangs below it`, async ({
      diagramPage: page,
    }) => {
      const pageErrors: Error[] = [];
      page.on("pageerror", (err) => pageErrors.push(err));

      const node = await addWidget(page, kind);
      const before = await node.boundingBox();
      await typeMultilineText(page, node);
      await page.waitForTimeout(300);

      const after = await node.boundingBox();
      const label = node.locator(".shape-node-svg-label");
      const labelBox = await label.boundingBox();
      if (!before || !after || !labelBox) throw new Error("box not found");
      expect(after.height).toBeCloseTo(before.height, 0);
      expect(labelBox.y).toBeGreaterThanOrEqual(after.y + after.height - 1);
      await expect(label).toHaveText(/Line1/);
      expect(pageErrors).toEqual([]);
    });
  }

  test("in dark mode the text of an icon shape is readable: dark ink inside the shape, white below it", async ({
    diagramPage: page,
  }) => {
    await page.getByRole("button", { name: "Dark mode" }).click();
    const colorOf = async (kind: string) => {
      const node = await addWidget(page, kind);
      await node.dblclick();
      await page.locator(".shape-node-textarea").fill("Orders");
      await page.mouse.click(20, 20);
      const label = node.locator(".shape-node-svg-label");
      await expect(label).toContainText("Orders");
      return label.evaluate((el) => getComputedStyle(el).color);
    };
    // Inside the shape: dark ink on the light fill.
    expect(await colorOf("Database")).toBe("rgb(29, 29, 31)");
    // Hanging over the dark canvas: white.
    expect(await colorOf("Server")).toBe("rgb(255, 255, 255)");
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
