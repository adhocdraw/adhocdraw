// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

// scripts/check-live-site.mjs is what runs against the deployed site after each deploy.
// Here it runs against the local build (must pass) and against a misbehaving server
// (must fail), and the same expectations are checked directly in the browser.
const script = resolve(process.cwd(), "scripts/check-live-site.mjs");
// Asynchronous (not spawnSync): the misbehaving test server below runs in this process
// and must stay responsive while the check runs.
const runCheck = (url: string) =>
  new Promise<{ code: number | null; out: string }>((done) => {
    const child = spawn("node", [script, url]);
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => done({ code, out }));
  });

test.describe("Live-site privacy check", () => {
  test("passes against the app's own build", async ({ baseURL }) => {
    const { code, out } = await runCheck(baseURL!);
    expect(out).toContain("All checks passed");
    expect(code).toBe(0);
  });

  test("fails for a site that sets a cookie, calls another origin and has no CSP", async () => {
    test.setTimeout(90_000); // the check waits for the hanging foreign request
    const server = createServer((req, res) => {
      res.setHeader("Set-Cookie", "tracker=1; Path=/");
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><title>x</title><script src="https://example.invalid/t.js"></script>');
    });
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
    try {
      const { code, out } = await runCheck(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
      expect(code).toBe(1);
      expect(out).toContain("Content-Security-Policy meta tag");
      expect(out).toContain("requests to other origins");
      expect(out).toContain("Set-Cookie header");
    } finally {
      server.close();
    }
  });

  test("using the app sets no cookies and stores only the app's known keys and database", async ({ diagramPage: page }) => {
    await page.getByRole("button", { name: /^(Dark|Light) mode$/ }).click();
    await page.getByRole("button", { name: /^Theme/ }).click();
    await page.waitForTimeout(500);
    expect(await page.context().cookies()).toEqual([]);
    const stored = await page.evaluate(async () => ({
      cookie: document.cookie,
      keys: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      dbs: (await indexedDB.databases()).map((d) => d.name),
    }));
    expect(stored.cookie).toBe("");
    for (const k of stored.keys) expect(k).toMatch(/^(e2e\.\w+|darkMode|theme|adhocdraw[.\w:-]*)$/); // e2e.* is the test fixture's own flag
    expect(stored.session).toEqual([]);
    expect(stored.dbs).toEqual(["adhocdraw"]);
  });
});
