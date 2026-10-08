// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";

test.describe("Themes", () => {
  test("switches between Classic and Palette, in light and dark, and remembers the choice", async ({
    diagramPage: page,
  }) => {
    const app = page.locator(".app");
    await expect(app).not.toHaveClass(/theme-palette/);

    await page.getByRole("button", { name: "Theme: Classic" }).click();
    await expect(app).toHaveClass(/theme-palette/);
    await expect(page.getByRole("button", { name: "Theme: Palette" })).toBeVisible();

    await page.getByRole("button", { name: "Dark mode" }).click();
    await expect(app).toHaveClass(/theme-palette/);
    await expect(app).toHaveClass(/dark/);

    await page.goto("/");
    await expect(page.locator(".app")).toHaveClass(/theme-palette/);
    await expect(page.locator(".app")).toHaveClass(/dark/);

    await page.getByRole("button", { name: "Theme: Palette" }).click();
    await expect(page.locator(".app")).not.toHaveClass(/theme-palette/);
  });

  test("toolbar stays usable in the Palette theme", async ({ diagramPage: page }) => {
    await page.getByRole("button", { name: "Theme: Classic" }).click();
    await page.getByRole("button", { name: "Pencil" }).click();
    await expect(page.locator(".pencil-panel")).toBeVisible();
  });
});

test.describe("Palette theme: tube dock and brush tray", () => {
  test("shape buttons render as tubes and preset swatches stay clickable", async ({ diagramPage: page }) => {
    await page.getByRole("button", { name: "Theme: Classic" }).click();
    await page.locator(".shapes-toggle").click();
    const tube = page.locator(".shapes-panel .shape-btn").first();
    await expect(tube).toBeVisible();
    const cap = await tube.evaluate((el) => getComputedStyle(el, "::after").content);
    expect(cap).toBe('""');

    await page.getByRole("button", { name: "Close shapes panel" }).click();
    await page.getByRole("button", { name: "Pencil" }).click();
    await page.getByRole("button", { name: "Color #e03131" }).click();
    await expect(page.getByRole("button", { name: "Color #e03131" })).toHaveClass(/active/);
  });
});

test("Palette: the New menu opens in front of the diagram tabs", async ({ diagramPage: page }) => {
  await page.getByRole("button", { name: "Theme: Classic" }).click();
  await page.getByRole("button", { name: /^New/ }).click();
  const panel = page.locator(".flyout-panel").first();
  await expect(panel).toBeVisible();
  const b = await panel.boundingBox();
  if (!b) throw new Error("no box");
  // The element at the panel's centre belongs to the panel, not a tab/canvas.
  const onTop = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".flyout-panel"),
    { x: b.x + b.width / 2, y: b.y + b.height - 6 }
  );
  expect(onTop).toBe(true);
});

test("Palette toolbar is compact: about half the Classic height at a wide window", async ({ diagramPage: page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  const classic = (await page.locator(".canvas-header").boundingBox())!.height;
  await page.getByRole("button", { name: "Theme: Classic" }).click();
  const palette = (await page.locator(".canvas-header").boundingBox())!.height;
  expect(palette).toBeLessThanOrEqual(130);
  expect(palette).toBeLessThan(classic);
});

test("Palette: the footer is a board-coloured bottom edge with rounded corners", async ({ diagramPage: page }) => {
  await page.getByRole("button", { name: "Theme: Classic" }).click();
  const s = await page.locator(".canvas-footer").evaluate((el) => {
    const c = getComputedStyle(el);
    return { radius: parseFloat(c.borderBottomLeftRadius), bg: c.backgroundColor };
  });
  expect(s.radius).toBeGreaterThan(15);
  expect(s.bg).not.toBe("rgb(255, 255, 255)");
  expect(s.bg).not.toBe("rgba(0, 0, 0, 0)");
});

test("Classic (light and dark): zoom controls are a rounded pill in the theme colours", async ({ diagramPage: page }) => {
  for (const dark of [false, true]) {
    if (dark) await page.getByRole("button", { name: "Dark mode" }).click();
    await page.waitForTimeout(250);
    const s = await page.locator(".react-flow__controls").evaluate((el) => {
      const c = getComputedStyle(el);
      return { radius: parseFloat(c.borderTopLeftRadius), bg: c.backgroundColor };
    });
    expect(s.radius).toBeGreaterThan(15);
    if (dark) expect(s.bg).not.toBe("rgb(255, 255, 255)");
  }
});

test("pencil line-style dropdown follows the theme and mode", async ({ diagramPage: page }) => {
  await page.getByRole("button", { name: "Pencil" }).click();
  const select = page.getByLabel("Pencil line style");
  const read = () =>
    select.evaluate((el) => {
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, color: c.color, radius: parseFloat(c.borderTopLeftRadius) };
    });
  const light = await read();
  expect(light.bg).toBe("rgb(255, 255, 255)");
  expect(light.radius).toBeGreaterThanOrEqual(6);

  await page.getByRole("button", { name: "Dark mode" }).click();
  await page.waitForTimeout(250);
  const dark = await read();
  expect(dark.bg).not.toBe("rgb(255, 255, 255)");
  expect(dark.color).not.toBe(light.color);

  await page.getByRole("button", { name: "Theme: Classic" }).click();
  await page.waitForTimeout(250);
  const palette = await read();
  expect(palette.radius).toBeGreaterThan(12);
});

test("minimap shows each node in its own colour and outlines the viewport", async ({ diagramPage: page }) => {
  const { addWidget } = await import("./helpers");
  await addWidget(page, "Process");
  await addWidget(page, "Sticky Note");
  const fills = await page.locator(".react-flow__minimap-node").evaluateAll((els) => els.map((el) => getComputedStyle(el).fill));
  expect(fills.length).toBe(2);
  expect(new Set(fills).size).toBe(2); // shape and sticky differ - not one grey for all
  const stroke = await page.locator(".react-flow__minimap-mask").evaluate((el) => getComputedStyle(el).stroke);
  expect(stroke).not.toBe("none");
});

test("minimap draws a freehand stroke as a faint tint, not a solid block", async ({ diagramPage: page }) => {
  await page.getByRole("button", { name: "Pencil" }).click();
  const c = (await page.locator(".canvas-flow").boundingBox())!;
  await page.mouse.move(c.x + 200, c.y + 200);
  await page.mouse.down();
  await page.mouse.move(c.x + 330, c.y + 330, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
  const node = page.locator(".react-flow__minimap-node").first();
  await expect(node).toBeVisible();
  const style = (await node.getAttribute("style")) ?? "";
  expect(style).toMatch(/color-mix|transparent|rgba/);
  expect(style).not.toMatch(/fill:\s*(#333333|rgb\(51, 51, 51\))\s*[;"]?/);
});
