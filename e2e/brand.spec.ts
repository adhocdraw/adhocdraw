// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";

test.describe("Brand and diagram name", () => {
  test("the toolbar shows the AdhocDraw pencil logo linking to the website, and no title box", async ({ diagramPage: page }) => {
    const brand = page.locator(".canvas-header .brand");
    await expect(brand.getByRole("img", { name: "AdhocDraw" })).toBeVisible();
    expect((await brand.locator("svg").boundingBox())!.height).toBeCloseTo(34, 0);
    await expect(brand).toHaveAttribute("href", "https://www.adhocdraw.com");
    await expect(brand).toHaveAttribute("target", "_blank");
    await expect(brand).toHaveAttribute("rel", /noopener/);
    await expect(brand).toHaveAttribute("rel", /noreferrer/);
    expect((await brand.boundingBox())!.width).toBeLessThan(150);
    await expect(page.locator(".diagram-title")).toHaveCount(0);
    await expect(page).toHaveTitle("AdhocDraw");
  });

  test("the logo is off-black in the light theme and off-white in the dark theme", async ({ diagramPage: page }) => {
    const logo = page.locator(".canvas-header .app-logo");
    const colour = () => logo.evaluate((el) => getComputedStyle(el).color);
    expect(await colour()).toBe("rgb(26, 26, 26)");
    await page.getByRole("button", { name: "Dark mode" }).click();
    await expect.poll(colour).toBe("rgb(245, 245, 245)");
  });

  test("F2 renames the open diagram", async ({ diagramPage: page, diagram }) => {
    await page.locator(".canvas-flow").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("F2");
    const input = page.getByRole("textbox", { name: `Rename ${diagram.name}` });
    await expect(input).toBeFocused();
    await input.fill(`${diagram.name}-f2`);
    await input.press("Enter");
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(`${diagram.name}-f2`);
  });

  test("focus mode shows the diagram name in the bottom-left pill", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).click();
    await page.locator(".flyout-item", { hasText: /^White Board$/ }).click();
    const name = await page.locator(".diagram-tab.active .diagram-tab-name").innerText();
    await expect(page.locator(".focus-diagram-name")).toBeHidden();
    await page.locator(".focus-mode-btn").click();
    const pill = page.locator(".canvas-area.focus .focus-diagram-name");
    await expect(pill).toBeVisible();
    await expect(pill).toHaveAttribute("data-name", name);
    expect(await pill.evaluate((el) => getComputedStyle(el, "::before").content)).toBe(`"${name}"`);
  });

  test("the favicon is the app's own self-contained pencil SVG", async ({ page }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="icon"]').getAttribute("href");
    expect(href).toMatch(/^\.?\/favicon\.svg$/);
    const res = await page.request.get("/favicon.svg");
    expect(res.ok()).toBe(true);
    const svg = await res.text();
    expect(svg).toContain("<svg");
    expect(svg).not.toMatch(/href=|url\(http|<script|<image/);
    // Off-black by default, off-white when the system is in dark mode; no teal left.
    expect(svg).toContain("#1a1a1a");
    expect(svg).toMatch(/prefers-color-scheme:dark[^}]*\{[^}]*#f5f5f5/);
    expect(svg).not.toContain("#0d9488");
  });

  test("the About dialog shows the logo", async ({ diagramPage: page }) => {
    await page.getByRole("button", { name: /^About/ }).click();
    const logo = page.locator(".about-panel .about-logo");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("aria-label", "AdhocDraw");
    await expect(page.locator(".about-panel")).toContainText("The name AdhocDraw and its logo are not covered by that licence");
  });
});
