// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

// Post-deploy privacy smoke check against the LIVE site (or any URL):
//
//   node scripts/check-live-site.mjs [url]        (default https://www.adhocdraw.com)
//
// The build-time checks only see our own files. This loads the real, deployed site in
// a browser, uses it a little, and fails if anything contradicts the privacy notice:
//   - any request to another origin (including anything the host might inject),
//   - any Set-Cookie header, or any cookie in the browser,
//   - a missing/weakened Content-Security-Policy,
//   - browser storage other than the app's known localStorage keys and its one
//     IndexedDB database ("adhocdraw"),
//   - a Content-Security-Policy violation.
// Exit code 0 = all good. Run by .github/workflows/post-deploy-check.yml after each
// deploy and weekly; no accounts, tokens or secrets are involved.

import { chromium } from "@playwright/test";

const url = new URL(process.argv[2] ?? "https://www.adhocdraw.com");
const origin = url.origin;
const results = [];
const check = (ok, msg) => results.push({ ok, msg });

// localStorage keys the app is known to write (see client/src). Anything else is flagged.
const KNOWN_KEYS = /^(darkMode|theme|adhocdraw[.\w:-]*)$/;
const KNOWN_DBS = new Set(["adhocdraw"]);

const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const foreign = new Set();
  const setCookies = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.startsWith("data:") || u.startsWith("blob:")) return;
    if (new URL(u).origin !== origin) foreign.add(u);
  });
  page.on("response", async (r) => {
    try {
      const h = await r.allHeaders();
      if (h["set-cookie"]) setCookies.push(r.url());
    } catch {
      /* response gone */
    }
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });

  const res = await page.goto(url.href, { waitUntil: "commit", timeout: 30000 });
  // A hanging foreign script must not stop the check: wait for load, but only so long.
  await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});
  check(res?.ok() === true, `${url.href} loads (HTTP ${res?.status()})`);

  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content").catch(() => null);
  check(!!csp && /default-src 'self'/.test(csp) && /connect-src 'self'/.test(csp) && !/https?:\/\//.test(csp), "Content-Security-Policy meta tag is present and only allows the site's own origin");

  // Use the app a little: create a White Board, toggle dark mode.
  try {
    await page.getByRole("button", { name: /^New/ }).click({ timeout: 5000 });
    await page.locator(".flyout-item", { hasText: /^White Board$/ }).click({ timeout: 5000 });
    await page.getByRole("button", { name: /^(Dark|Light) mode$/ }).click({ timeout: 5000 });
    await page.waitForTimeout(1500);
  } catch (e) {
    check(false, `could not exercise the app (${String(e).split("\n")[0]})`);
  }

  check(foreign.size === 0, foreign.size ? `requests to other origins: ${[...foreign].join(", ")}` : "every request went to the site's own origin");
  check(setCookies.length === 0, setCookies.length ? `Set-Cookie header on: ${setCookies.join(", ")}` : "no response sets a cookie");
  const cookies = await context.cookies();
  check(cookies.length === 0, cookies.length ? `browser holds cookies: ${cookies.map((c) => c.name).join(", ")}` : "the browser holds no cookies");
  const stored = await page.evaluate(async () => ({
    cookie: document.cookie,
    keys: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    dbs: (await indexedDB.databases()).map((d) => d.name),
    csp: window.__csp,
  }));
  check(stored.cookie === "", "document.cookie is empty");
  const badKeys = stored.keys.filter((k) => !KNOWN_KEYS.test(k));
  check(badKeys.length === 0, badKeys.length ? `unexpected localStorage keys: ${badKeys.join(", ")}` : `localStorage holds only known keys (${stored.keys.length})`);
  check(stored.session.length === 0, stored.session.length ? `unexpected sessionStorage keys: ${stored.session.join(", ")}` : "sessionStorage is empty");
  const badDbs = stored.dbs.filter((n) => !KNOWN_DBS.has(n));
  check(badDbs.length === 0, badDbs.length ? `unexpected IndexedDB databases: ${badDbs.join(", ")}` : "IndexedDB holds only the app's own database");
  check(stored.csp.length === 0, stored.csp.length ? `CSP violations: ${stored.csp.join("; ")}` : "no Content-Security-Policy violations");
} finally {
  await browser.close();
}

console.log(`\nLive-site privacy check: ${url.href}\n`);
for (const r of results) console.log(`${r.ok ? "[ok]  " : "[FAIL]"} ${r.msg}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} problem(s): the site no longer matches the privacy notice.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
