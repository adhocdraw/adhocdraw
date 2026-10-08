// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";

// getComputedStyle can return modern color() syntax (e.g. for color-mix); a
// 1px canvas turns any CSS color into plain [r, g, b].
const rgbOf = (btn: import("@playwright/test").Locator) =>
  btn.evaluate((el) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.fillStyle = getComputedStyle(el).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  });

for (const [label, selector] of [
  ["Pencil", ".pencil-btn"],
  ["Select", ".select-mode-btn"],
] as const) {
  test.describe(`${label} toggle button colors`, () => {
    test("keeps its solid group color while the pointer rests on it, and in dark mode", async ({ diagramPage: page }) => {
      const btn = page.locator(selector);
      await btn.click(); // pointer is now resting on the button
      await expect(btn).toHaveClass(/active/);
      // The pointer is still resting on it (hover shade of the same blue).
      // (poll: the color eases in over a fraction of a second)
      await expect
        .poll(async () => {
          const c = await rgbOf(btn);
          return c[2] - c[0];
        })
        .toBeGreaterThan(60);

      await btn.hover();
      await page.waitForTimeout(150);
      // Hover may darken it slightly, but never washes it out to white/grey.
      const [r, g, b] = await rgbOf(btn);
      expect(b).toBeGreaterThan(r + 60);
      await expect(btn).toHaveCSS("color", "rgb(255, 255, 255)");

      await page.getByRole("button", { name: "Dark mode" }).click();
      await btn.hover();
      await page.waitForTimeout(150);
      const [dr, , db] = await rgbOf(btn);
      expect(db).toBeGreaterThan(dr + 60);
      expect(g).toBeGreaterThan(0);
    });

    test("goes back to the plain button color when switched off", async ({ diagramPage: page }) => {
      const btn = page.locator(selector);
      await btn.click();
      await btn.click();
      await expect(btn).not.toHaveClass(/active/);
      await expect(btn).toHaveCSS("background-color", /rgb\((2[0-9]{2}|24\d), /);
    });
  });
}

test("the Shapes button keeps its solid color while hovered when the panel is open", async ({ diagramPage: page }) => {
  const btn = page.locator(".shapes-toggle");
  await btn.click();
  await expect(btn).toHaveClass(/active/);
  await btn.hover();
  await page.waitForTimeout(150);
  const [r, , b] = await rgbOf(btn);
  expect(b).toBeGreaterThan(r + 60);
});
