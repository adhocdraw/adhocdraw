// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Page } from "@playwright/test";
import { addWidget, createDiagramFromMenu, mockFileSystemAccess } from "../e2e/helpers";

test.beforeEach(async ({ page }) => {
  // Leaving the page with work that is not in a file asks for confirmation;
  // accept it so reloads in tests go through.
  page.on("dialog", (d) => d.accept());
  await page.addInitScript(() => {
    (window as unknown as { __cspViolations: string[] }).__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __cspViolations: string[] }).__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
    try {
      if (!localStorage.getItem("e2e.seeded")) {
        localStorage.setItem("e2e.seeded", "1");
        localStorage.setItem("adhocdraw.shapesPanel", JSON.stringify({ open: false, collapsed: false }));
      }
    } catch {
      // storage unavailable
    }
  });
});

const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);

test.describe("Content-Security-Policy and privacy notices", () => {
  test("the page carries a CSP that only allows its own files", async ({ page }) => {
    await page.goto("/");
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' data: blob:");
    expect(csp).not.toMatch(/https?:\/\//);
  });

  test("the browser refuses connections and scripts from other sites", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      try {
        await fetch("https://example.com/");
        return "allowed";
      } catch {
        return "blocked";
      }
    });
    expect(result).toBe("blocked");
    await page.evaluate(() => {
      const img = document.createElement("img");
      img.src = "https://example.com/pixel.png";
      document.body.appendChild(img);
    });
    await expect.poll(() => violations(page)).toEqual(expect.arrayContaining([expect.stringContaining("example.com")]));
  });

  test("using every feature triggers no CSP violation", async ({ page }) => {
    await mockFileSystemAccess(page);
    await page.goto("/");
    await createDiagramFromMenu(page, `csp-${Date.now()}`);
    await addWidget(page, "Process");
    await addWidget(page, "Cloud");
    // an embedded image via custom shape upload
    await page.locator(".shapes-toggle").click();
    await page.setInputFiles(".custom-shape-input", {
      name: "dot.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><circle cx="2" cy="2" r="2"/></svg>'),
    });
    await page.locator(".shape-btn", { hasText: "dot" }).dblclick();
    await page.locator(".shapes-dock-close").click();

    for (const item of ["Export PNG", "Export SVG", "Export PDF"]) {
      await page.getByRole("button", { name: /^Export/ }).click();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: item }).click(),
      ]);
      expect(download.suggestedFilename()).toBeTruthy();
    }
    await page.getByRole("button", { name: "History" }).click();
    await page.keyboard.press("Escape");
    expect(await violations(page)).toEqual([]);
  });

  test("About shows the privacy notice with links to the license files", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "About" }).click();
    const dialog = page.getByRole("dialog", { name: "About and privacy" });
    await expect(dialog).toContainText("Your diagrams stay on your device");
    await expect(dialog).toContainText("built so that it does not send your diagrams");
    await expect(dialog).toContainText("There are no accounts, cookies, analytics or tracking");
    // Plain-language limits and the promise to fix and say so (no developer instructions here).
    await expect(dialog).toContainText("What we can't control");
    await expect(dialog).toContainText("GitHub, which may keep ordinary server logs");
    await expect(dialog).toContainText("Browser extensions, shared computers");
    await expect(dialog).toContainText("If we get it wrong");
    await expect(dialog).toContainText("Privacy notice last updated");
    await expect(dialog).not.toContainText("developer tools");
    await expect(dialog).not.toContainText("Network tab");
    await expect(dialog.getByRole("link", { name: "Privacy details" })).toHaveAttribute("href", "./PRIVACY.txt");
    await expect(dialog.getByRole("link", { name: "Report a problem" })).toHaveAttribute(
      "href",
      "https://github.com/adhocdraw/adhocdraw/issues/new",
    );
    await expect(dialog.getByRole("link", { name: "License", exact: true })).toHaveAttribute("href", "./LICENSE.txt");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("the app is named AdhocDraw: page title, About text and website link, trademark note", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("AdhocDraw");
    await page.getByRole("button", { name: "About" }).click();
    const dialog = page.getByRole("dialog", { name: "About and privacy" });
    await expect(dialog).toContainText("AdhocDraw");
    await expect(dialog.getByRole("link", { name: "www.adhocdraw.com" })).toHaveAttribute("href", "https://www.adhocdraw.com");
    const notice = await (await page.request.get("/NOTICE.txt")).text();
    expect(notice).toContain("AdhocDraw");
    expect(notice).toContain("all rights reserved");
    expect(notice).toContain("Trademarks");
    // No leftover old name in what users see.
    expect(await page.content()).not.toMatch(new RegExp("Idea" + "tion", "i"));
  });

  test("the privacy notice is shipped with the app, with the limits and how to verify", async ({ page }) => {
    const res = await page.request.get("/PRIVACY.txt");
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(text).toContain("built so that your diagrams stay on your device");
    expect(text).toContain("What the app cannot control");
    expect(text).toContain("If something is wrong");
    expect(text).toContain("For technical readers: how to verify this");
    expect(text).toContain("Last updated");
  });

  test("the license files are shipped with the app", async ({ page }) => {
    const license = await page.request.get("/LICENSE.txt");
    expect(license.ok()).toBe(true);
    expect(await license.text()).toContain("Apache License");
    expect(await license.text()).toContain("Version 2.0, January 2004");
    const notice = await page.request.get("/NOTICE.txt");
    expect(notice.ok()).toBe(true);
    expect(await notice.text()).toContain("Copyright 2026 Vikranth Pandiri");
    const third = await page.request.get("/third-party-licenses.txt");
    expect(third.ok()).toBe(true);
    const text = await third.text();
    expect(text).toContain("@xyflow/react");
    expect(text).toContain("react@");
  });


  test("the app refuses to run inside another page (GitHub Pages cannot send frame-ancestors)", async ({ page }) => {
    // A real page on another origin (a different port) that embeds the app.
    const host = createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end('<iframe id="f" src="http://localhost:4173/" style="width:900px;height:600px"></iframe>');
    });
    await new Promise<void>((resolve) => host.listen(0, "localhost", resolve));
    try {
      await page.goto(`http://localhost:${(host.address() as AddressInfo).port}/`);
      const frame = page.frameLocator("#f");
      await expect(frame.locator("body")).toContainText("cannot be shown inside another page");
      await expect(frame.locator(".app")).toHaveCount(0);
    } finally {
      host.close();
    }
  });

  test("the page asks browsers not to send a referrer, and carries the CSP in a meta tag", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute("content", /default-src 'self'/);
  });
});
