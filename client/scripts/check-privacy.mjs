// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

// Privacy guard for the hosted (server-less) build: fails when a change could make
// AdhocDraw contact another site or pull in an unreviewed library.
//
//   node scripts/check-privacy.mjs [--root <client dir>]
//
// 1. Source: no network calls (fetch, XMLHttpRequest, WebSocket, EventSource,
//    sendBeacon, service workers, remote imports) and no external URLs, except the
//    allow-listed spots below.
// 2. Dependencies: every production dependency must be listed in
//    scripts/privacy-allowed-dependencies.json (a deliberate, reviewable step).
// 3. Build output (dist, when present): no remote scripts, styles, images or
//    fonts, and a Content-Security-Policy that only allows the site's own files.
//
// Runs as part of `npm run build`, so a violating build fails.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const argRoot = process.argv.indexOf("--root");
const root = resolve(argRoot > -1 ? process.argv[argRoot + 1] : join(here, ".."));
const problems = [];
const fail = (msg) => problems.push(msg);

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

// ---- 1. source ----------------------------------------------------------------
// No file may make network requests of its own: the app has no server.
const NETWORK_ALLOWED_FILES = new Set([]);
const NETWORK_PATTERNS = [
  [/\bfetch\s*\(/, "fetch()"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bnew\s+WebSocket\b/, "WebSocket"],
  [/\bEventSource\b/, "EventSource"],
  [/\bsendBeacon\b/, "sendBeacon"],
  [/\bserviceWorker\b/, "service worker"],
  [/\bimport\s*\(\s*["'`]https?:/, "remote import()"],
  [/\bimportScripts\b/, "importScripts"],
];
// External URLs that may appear in source: plain links the user can click, XML
// namespaces, a placeholder, and the server-mode default.
const URL_ALLOWED = [
  /^https?:\/\/www\.w3\.org\//,
  /^https:\/\/www\.adhocdraw\.com/,
  /^https:\/\/github\.com\/adhocdraw\/adhocdraw/,
  /^https:\/\/reactflow\.dev/,
  /^https:\/\/example\.com/,
];
for (const file of walk(join(root, "src"), [".ts", ".tsx", ".css"])) {
  const rel = relative(root, file).split("\\").join("/");
  if (rel.endsWith(".d.ts")) continue;
  const text = readFileSync(file, "utf8");
  if (!NETWORK_ALLOWED_FILES.has(rel)) {
    for (const [re, label] of NETWORK_PATTERNS) {
      if (re.test(text)) fail(`${rel}: uses ${label} - the app must not make network requests of its own`);
    }
  }
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
    if (!URL_ALLOWED.some((re) => re.test(m[0]))) fail(`${rel}: external URL ${m[0]} (not on the allow list)`);
  }
}

// ---- 2. dependencies ----------------------------------------------------------
const pkgPath = join(root, "package.json");
const allowPath = join(root, "scripts", "privacy-allowed-dependencies.json");
if (existsSync(pkgPath) && existsSync(allowPath)) {
  const deps = Object.keys(JSON.parse(readFileSync(pkgPath, "utf8")).dependencies ?? {});
  const allowed = new Set(JSON.parse(readFileSync(allowPath, "utf8")).dependencies ?? []);
  for (const d of deps) {
    if (!allowed.has(d)) fail(`package.json: new dependency "${d}" is not in scripts/privacy-allowed-dependencies.json - review it first`);
  }
}

// ---- 3. build output ----------------------------------------------------------
const dist = join(root, "dist");
if (existsSync(dist)) {
  const html = existsSync(join(dist, "index.html")) ? readFileSync(join(dist, "index.html"), "utf8") : "";
  for (const m of html.matchAll(/\b(?:src|href|action|data)=["'](https?:)?\/\/([^"']+)/g)) {
    fail(`dist/index.html: loads or links external resource //${m[2]}`);
  }
  // The policy itself contains single quotes ('self'), so match on the attribute's own quote.
  const cspTag = html.match(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i)?.[0] ?? "";
  const rawCsp = cspTag.match(/content="([^"]*)"/i)?.[1] ?? cspTag.match(/content='([^']*)'/i)?.[1];
  const csp = rawCsp?.replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
  if (!csp) fail("dist/index.html: no Content-Security-Policy meta tag");
  else {
    if (!/default-src\s+'self'/.test(csp)) fail("CSP: default-src must be 'self'");
    for (const directive of csp.split(";").map((s) => s.trim()).filter(Boolean)) {
      if (/(https?:|wss?:|\*)/.test(directive) && !/^frame-ancestors/.test(directive)) {
        fail(`CSP: directive "${directive}" allows outside hosts`);
      }
    }
    if (!/connect-src\s+'self'/.test(csp)) fail("CSP: connect-src must be limited to 'self'");
  }
  for (const file of walk(dist, [".css"])) {
    const text = readFileSync(file, "utf8");
    if (/@import\s+(url\()?["']?https?:/.test(text) || /url\(\s*["']?https?:/.test(text)) {
      fail(`${relative(root, file)}: CSS loads a remote file`);
    }
  }
  for (const file of walk(dist, [".js"])) {
    const text = readFileSync(file, "utf8");
    const rel = relative(root, file);
    if (/\bnew\s+WebSocket\s*\(/.test(text)) fail(`${rel}: opens a WebSocket`);
    if (/\bnavigator\.sendBeacon\b/.test(text)) fail(`${rel}: uses sendBeacon`);
    if (/\bnew\s+EventSource\s*\(/.test(text)) fail(`${rel}: opens an EventSource`);
    if (/\bfetch\(\s*["'`]https?:/.test(text)) fail(`${rel}: fetches a remote URL`);
    if (/\bimport\(\s*["'`]https?:/.test(text)) fail(`${rel}: imports a remote module`);
  }
}

if (problems.length > 0) {
  console.error("\nPrivacy check FAILED:\n" + problems.map((p) => "  - " + p).join("\n") + "\n");
  console.error("AdhocDraw must not contact other sites or add unreviewed libraries. See CONTRIBUTING.md.\n");
  process.exit(1);
}
console.log("Privacy check passed.");
