// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

test.describe("Tooltips", () => {
  test("a tooltip appears quickly when hovering the Fit View control (not after the browser's multi-second delay)", async ({
    diagramPage: page,
  }) => {
    const fit = page.getByRole("button", { name: "Fit View" });
    const start = Date.now();
    await fit.hover();
    await expect(page.locator(".app-tooltip")).toHaveText("Fit View", { timeout: 1500 });
    expect(Date.now() - start).toBeLessThan(1500);
  });

  test("toolbar buttons that only had a text label now have a tooltip", async ({ diagramPage: page }) => {
    const cases: [string, RegExp][] = [
      ["History", /version history/i],
      ["Find", /find and replace/i],
      ["Present", /full screen/i],
      ["Shortcuts", /keyboard shortcuts/i],
      ["About", /privacy/i],
      ["Dark mode", /dark theme/i],
    ];
    for (const [name, tip] of cases) {
      // Hover can land mid-layout right after load; retry the hover itself.
      await expect(async () => {
        await page.mouse.move(5, 300);
        await page.getByRole("button", { name, exact: true }).hover();
        await expect(page.locator(".app-tooltip")).toHaveText(tip, { timeout: 1500 });
      }).toPass({ timeout: 8000 });
      await page.mouse.move(5, 300); // away
      await expect(page.locator(".app-tooltip")).toHaveCount(0);
    }
  });

  test("the New and Export menu buttons have tooltips too", async ({ diagramPage: page }) => {
    await page.getByRole("button", { name: /^New/ }).hover();
    await expect(page.locator(".app-tooltip")).toContainText("Create a new diagram", { timeout: 1500 });
    await page.mouse.move(5, 300);
    await expect(async () => {
      await page.mouse.move(5, 300);
      await page.getByRole("button", { name: /^Export/ }).hover();
      await expect(page.locator(".app-tooltip")).toContainText("Export the diagram", { timeout: 1500 });
    }).toPass({ timeout: 8000 });
  });

  test("the native browser title is held back while the tooltip shows and restored after", async ({
    diagramPage: page,
  }) => {
    const save = page.getByRole("button", { name: "Save to file" });
    const before = await save.getAttribute("title");
    expect(before).toBeTruthy();
    await save.hover();
    await expect(page.locator(".app-tooltip")).toBeVisible();
    expect(await save.getAttribute("title")).toBeNull();
    await page.mouse.move(5, 300);
    await expect(page.locator(".app-tooltip")).toHaveCount(0);
    expect(await save.getAttribute("title")).toBe(before);
  });

  test("keyboard focus shows the tooltip too", async ({ diagramPage: page }) => {
    await page.getByRole("button", { name: "History" }).focus();
    await page.keyboard.press("Shift+Tab"); // moves focus (visible-focus mode)
    await page.keyboard.press("Tab");
    await expect(page.locator(".app-tooltip")).toBeVisible({ timeout: 1500 });
  });

  test("the tooltip goes away when the button is clicked", async ({ diagramPage: page }) => {
    await page.getByRole("button", { name: "Find" }).hover();
    await expect(page.locator(".app-tooltip")).toBeVisible({ timeout: 1500 });
    await page.getByRole("button", { name: "Find" }).click();
    await expect(page.locator(".app-tooltip")).toHaveCount(0);
  });

  test("page tab controls get a tooltip from their label", async ({ diagramPage: page }) => {
    await page.mouse.move(5, 300);
    await page.getByRole("button", { name: "+ Page" }).hover();
    await expect(page.locator(".app-tooltip")).toContainText("Add a new page", { timeout: 1500 });
  });

  test("no icon-only button or toolbar button is left without a tooltip text", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    const missing = await page.evaluate(() => {
      const bad: string[] = [];
      const buttons = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']"));
      for (const b of buttons) {
        if (!(b.offsetWidth || b.offsetHeight)) continue;
        const text = (b.textContent ?? "").trim();
        const tip = b.getAttribute("title") ?? b.getAttribute("aria-label");
        const inToolbar = b.matches(".canvas-header-actions > button, .canvas-header-meta > button, .flyout-trigger");
        const iconOnly = text === "" || /^[×◀▶‹›▾▸⠿●]$/.test(text);
        if ((iconOnly || inToolbar) && !tip) bad.push(b.outerHTML.slice(0, 120));
      }
      return bad;
    });
    expect(missing).toEqual([]);
  });
});
