// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";

// "Add to Home Screen" support is a plain manifest plus icons. It must not bring in a
// service worker (the privacy rules forbid one) or touch any other site.
test.describe("Install as an app (manifest, no service worker)", () => {
  test("the page links a same-site manifest and the Home Screen icon", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /^(\.|)\/?manifest\.webmanifest$/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /^(\.|)\/?apple-touch-icon\.png$/);
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "AdhocDraw");
  });

  test("the manifest names the app and its icons exist", async ({ page }) => {
    const res = await page.request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.name).toBe("AdhocDraw");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("./");
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(m.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
    for (const icon of [...m.icons.map((i: { src: string }) => i.src), "apple-touch-icon.png"]) {
      // Every icon is a file on this same site (relative path), and a real PNG.
      expect(icon).not.toMatch(/^[a-z]+:/i);
      const r = await page.request.get(`/${icon}`);
      expect(r.ok()).toBe(true);
      expect(r.headers()["content-type"]).toContain("image/png");
    }
  });

  test("no service worker is registered, and no request leaves the site", async ({ page }) => {
    const foreign: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (!["localhost", "127.0.0.1"].includes(u.hostname) && !["data:", "blob:"].includes(u.protocol)) foreign.push(r.url());
    });
    await page.goto("/");
    await page.waitForTimeout(500);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
    expect(foreign).toEqual([]);
  });
});
