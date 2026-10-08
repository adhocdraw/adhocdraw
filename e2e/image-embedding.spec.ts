// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { settleLayout } from "./helpers";

const TEST_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function dropTestImage(page: import("@playwright/test").Page, x: number, y: number) {
  await page.evaluate(
    async ({ dataUrl, x, y }) => {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "test.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const target = document.querySelector(".canvas-flow")!;
      const ev = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(ev, "dataTransfer", { value: dt });
      Object.defineProperty(ev, "clientX", { value: x });
      Object.defineProperty(ev, "clientY", { value: y });
      target.dispatchEvent(ev);
    },
    { dataUrl: TEST_PNG_DATA_URL, x, y }
  );
}

test.describe("Image embedding", () => {
  test("dropping an image file onto the canvas creates a resizable image node", async ({ diagramPage: page }) => {
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    await dropTestImage(page, canvasBox.x + 300, canvasBox.y + 300);

    const node = page.locator(".react-flow__node-image");
    await expect(node).toHaveCount(1);
    // Images are embedded in the diagram itself (a data: URL) - nothing is uploaded anywhere.
    await expect(node.locator("img")).toHaveAttribute("src", /^data:image\//);

    await node.click();
    await expect(page.locator(".react-flow__resize-control")).not.toHaveCount(0);
  });

  test("an image node is movable, deletable, and persists across reload", async ({ diagramPage: page, diagram }) => {
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    await dropTestImage(page, canvasBox.x + 300, canvasBox.y + 300);
    const node = page.locator(".react-flow__node-image");
    await expect(node).toHaveCount(1);
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    const src = await node.locator("img").getAttribute("src");

    await page.goto("/");
    await page.getByText(diagram.name, { exact: true }).click();
    await settleLayout(page);
    await expect(page.locator(".react-flow__node-image")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-image img")).toHaveAttribute("src", src!);

    await page.locator(".react-flow__node-image").click();
    await page.keyboard.press("Delete");
    await expect(page.locator(".react-flow__node-image")).toHaveCount(0);
  });

  test("pasting an image from the clipboard creates an image node", async ({ diagramPage: page }) => {
    await page.evaluate(async (dataUrl) => {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "pasted.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const ev = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
      window.dispatchEvent(ev);
    }, TEST_PNG_DATA_URL);

    await expect(page.locator(".react-flow__node-image")).toHaveCount(1);
  });
});
