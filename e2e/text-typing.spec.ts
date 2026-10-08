// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { createDiagramFromMenu } from "./helpers";

async function canvasPoint(page: import("@playwright/test").Page, dx: number, dy: number) {
  const c = await page.locator(".canvas-flow").boundingBox();
  if (!c) throw new Error("canvas not found");
  return { x: c.x + dx, y: c.y + dy };
}

test.describe("Typing straight onto the canvas", () => {
  test("double-clicking empty canvas opens a text box; typing and clicking away commits it", async ({
    diagramPage: page,
  }) => {
    const p = await canvasPoint(page, 300, 200);
    await page.mouse.dblclick(p.x, p.y);
    const box = page.locator(".text-node-textarea");
    await expect(box).toBeFocused();
    await page.keyboard.type("Hello board");
    await page.mouse.click(p.x + 400, p.y + 100);
    await expect(page.locator(".text-node-textarea")).toHaveCount(0);
    await expect(page.locator(".text-node-text")).toHaveText("Hello board");
    await expect(page.locator(".react-flow__node-text")).toHaveCount(1);
  });

  test("Enter adds a line and the box grows; Escape commits", async ({ diagramPage: page }) => {
    const p = await canvasPoint(page, 300, 200);
    await page.mouse.dblclick(p.x, p.y);
    await expect(page.locator(".text-node-textarea")).toBeFocused();
    const node = page.locator(".react-flow__node-text");
    const before = (await node.boundingBox())!.height;
    await page.keyboard.type("one");
    for (const line of ["two", "three", "four"]) {
      await page.keyboard.press("Enter");
      await page.keyboard.type(line);
    }
    await expect.poll(async () => (await node.boundingBox())!.height).toBeGreaterThan(before + 20);
    await page.keyboard.press("Escape");
    await expect(page.locator(".text-node-textarea")).toHaveCount(0);
    await expect(page.locator(".text-node-text")).toContainText("four");
  });

  test("an empty text box is discarded", async ({ diagramPage: page }) => {
    const p = await canvasPoint(page, 300, 200);
    await page.mouse.dblclick(p.x, p.y);
    await expect(page.locator(".text-node-textarea")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });

  test("the Text tool (button or T) drops a text box wherever you click, and stays on until Escape", async ({
    diagramPage: page,
  }) => {
    await page.keyboard.press("t");
    await expect(page.getByRole("button", { name: "Text tool" })).toHaveAttribute("aria-pressed", "true");
    for (const [i, word] of ["alpha", "beta"].entries()) {
      const p = await canvasPoint(page, 250 + i * 300, 220);
      await page.mouse.click(p.x, p.y);
      await expect(page.locator(".text-node-textarea")).toBeFocused();
      await page.keyboard.type(word);
      await page.keyboard.press("Escape"); // commit
    }
    await expect(page.locator(".react-flow__node-text")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Text tool" })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape"); // leave the tool
    await expect(page.getByRole("button", { name: "Text tool" })).toHaveAttribute("aria-pressed", "false");

    // The button works too, and is exclusive with Pencil.
    await page.getByRole("button", { name: "Text tool" }).click();
    await expect(page.getByRole("button", { name: "Text tool" })).toHaveAttribute("aria-pressed", "true");
    await page.locator(".pencil-btn").click();
    await expect(page.getByRole("button", { name: "Text tool" })).toHaveAttribute("aria-pressed", "false");
  });

  test("while the Pencil is on, double-click does not create text", async ({ diagramPage: page }) => {
    await page.locator(".pencil-btn").click();
    const p = await canvasPoint(page, 300, 200);
    await page.mouse.dblclick(p.x, p.y);
    await expect(page.locator(".text-node-textarea")).toHaveCount(0);
    await expect(page.locator(".react-flow__node-text")).toHaveCount(0);
  });

  test("typed text is Auto-coloured: black on light, white on dark, and flips with the mode", async ({
    diagramPage: page,
  }) => {
    const p = await canvasPoint(page, 300, 200);
    await page.mouse.dblclick(p.x, p.y);
    await page.keyboard.type("Auto colour"); // no wait for focus: typing must not lose letters
    await page.keyboard.press("Escape");
    const text = page.locator(".text-node-text");
    const colour = () => text.evaluate((el) => getComputedStyle(el).color);
    expect(await colour()).toBe("rgb(0, 0, 0)");
    await page.getByRole("button", { name: "Dark mode" }).click();
    await expect.poll(colour).toBe("rgb(255, 255, 255)");
  });

  test("typed text is saved, and reloading does not reopen it for editing", async ({ diagramPage: page, diagram }) => {
    const p = await canvasPoint(page, 300, 200);
    await page.mouse.dblclick(p.x, p.y);
    await page.keyboard.type("Kept");
    await page.keyboard.press("Escape");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
    await page.reload();
    await page.getByText(diagram.name, { exact: true }).click();
    await expect(page.locator(".text-node-text")).toHaveText("Kept");
    await expect(page.locator(".text-node-textarea")).toHaveCount(0);
  });

  test("on a ruled White Board, typed text sits on a rule", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `wb-text-${Date.now()}`, "White Board");
    await expect(page.locator(".notebook-rules")).toHaveCount(0); // plain by default
    await page.getByRole("button", { name: "Notebook lines" }).click();
    await expect(page.locator(".notebook-rules")).toHaveCount(1);
    await page.locator(".pencil-btn").click(); // Pencil off so a double-click makes text
    const p = await canvasPoint(page, 400, 260);
    await page.mouse.dblclick(p.x, p.y);
    await page.keyboard.type("On the line");
    await page.keyboard.press("Escape");
    const node = page.locator(".react-flow__node-text");
    const bottom = await node.evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return m.f + (el as HTMLElement).offsetHeight;
    });
    expect(Math.abs(bottom % 32) < 0.6 || Math.abs((bottom % 32) - 32) < 0.6).toBe(true);
  });
});

test.describe("Text boxes fit their text", () => {
  test("the box grows with more lines and shrinks again when text is removed", async ({ diagramPage: page }) => {
    const c = (await page.locator(".canvas-flow").boundingBox())!;
    await page.mouse.dblclick(c.x + 300, c.y + 200);
    const box = page.locator(".react-flow__node-text");
    const textarea = page.locator(".text-node-textarea");
    await expect(textarea).toBeFocused();
    const h1 = (await box.boundingBox())!.height;
    await page.keyboard.type("first");
    for (const l of ["second", "third", "fourth", "fifth", "sixth"]) {
      await page.keyboard.press("Enter");
      await page.keyboard.type(l);
    }
    await expect.poll(async () => (await box.boundingBox())!.height).toBeGreaterThan(h1 + 40);
    const tall = (await box.boundingBox())!.height;
    // Remove most of it: the box shrinks back.
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("short");
    await expect.poll(async () => (await box.boundingBox())!.height).toBeLessThan(tall - 40);
    await page.keyboard.press("Escape");
    // Still fits once committed, and re-editing keeps it fitted.
    await expect.poll(async () => (await box.boundingBox())!.height).toBeLessThan(tall - 40);
    await page.locator(".text-node-text").dblclick();
    await expect(page.locator(".text-node-textarea")).toBeFocused();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("a\nb\nc\nd\ne\nf");
    await expect.poll(async () => (await box.boundingBox())!.height).toBeGreaterThan(tall - 20);
  });

  test("a narrower box wraps the text onto more lines and grows taller", async ({ diagramPage: page }) => {
    const c = (await page.locator(".canvas-flow").boundingBox())!;
    await page.mouse.dblclick(c.x + 300, c.y + 200);
    await expect(page.locator(".text-node-textarea")).toBeFocused();
    await page.keyboard.type("A fairly long sentence that needs to wrap when the box is narrow");
    await page.keyboard.press("Escape");
    const box = page.locator(".react-flow__node-text");
    const wide = (await box.boundingBox())!;
    await box.click();
    const handle = box.locator(".react-flow__resize-control.handle.right").first();
    const hb = await handle.boundingBox();
    if (!hb) throw new Error("resize handle not found");
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x - 230, hb.y + hb.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await box.boundingBox())!.height).toBeGreaterThan(wide.height + 10);
  });
});

test.describe("Text boxes fit the width of short text", () => {
  test("a short text gives a narrow box that widens with the text, narrows again, and wraps at a limit", async ({
    diagramPage: page,
  }) => {
    const c = (await page.locator(".canvas-flow").boundingBox())!;
    await page.mouse.dblclick(c.x + 300, c.y + 200);
    await expect(page.locator(".text-node-textarea")).toBeFocused();
    const box = page.locator(".react-flow__node-text");
    const width = async () => (await box.boundingBox())!.width;

    await page.keyboard.type("Hi");
    await expect.poll(width).toBeLessThan(110);
    const short = await width();

    await page.keyboard.type(" there, this is a longer line of text");
    await expect.poll(width).toBeGreaterThan(short + 100);

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Hi");
    await expect.poll(width).toBeLessThan(110);

    // A very long line stops growing at the limit and wraps (height grows instead).
    const h0 = (await box.boundingBox())!.height;
    await page.keyboard.type("x ".repeat(120));
    await expect.poll(width).toBeLessThan(380);
    await expect.poll(async () => (await box.boundingBox())!.height).toBeGreaterThan(h0 + 30);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Hello");
    await page.keyboard.press("Escape");
    // Committed text keeps fitting its width.
    await expect.poll(width).toBeLessThan(120);
  });

  test("dragging the width yourself turns automatic width off", async ({ diagramPage: page }) => {
    const c = (await page.locator(".canvas-flow").boundingBox())!;
    await page.mouse.dblclick(c.x + 300, c.y + 200);
    await expect(page.locator(".text-node-textarea")).toBeFocused();
    await page.keyboard.type("Fit me");
    await page.keyboard.press("Escape");
    const box = page.locator(".react-flow__node-text");
    await box.click();
    const handle = box.locator(".react-flow__resize-control.handle.right").first();
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 150, hb.y + hb.height / 2, { steps: 8 });
    await page.mouse.up();
    const wide = (await box.boundingBox())!.width;
    expect(wide).toBeGreaterThan(180);
    // Editing the text no longer re-fits the width.
    await page.locator(".text-node-text").dblclick();
    await expect(page.locator(".text-node-textarea")).toBeFocused();
    await page.keyboard.type("!");
    await page.waitForTimeout(300);
    expect(Math.abs((await box.boundingBox())!.width - wide)).toBeLessThan(3);
  });
});
