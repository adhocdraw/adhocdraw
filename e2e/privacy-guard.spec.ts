// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "client", "scripts", "check-privacy.mjs");

// A tiny fake client folder to try the check on.
function fixture(files: Record<string, string>, deps: string[] = ["react"], allowed: string[] = ["react"]) {
  const dir = mkdtempSync(join(tmpdir(), "privacy-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: Object.fromEntries(deps.map((d) => [d, "1.0.0"])) }));
  writeFileSync(join(dir, "scripts", "privacy-allowed-dependencies.json"), JSON.stringify({ dependencies: allowed }));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, "src", name), text);
  return dir;
}
const run = (root: string) => spawnSync("node", [SCRIPT, "--root", root], { encoding: "utf8" });

test.describe("Privacy guard (npm run check:privacy)", () => {
  test("passes on the real project (source, dependencies and the built hosted app)", () => {
    const out = execFileSync("node", [SCRIPT], { encoding: "utf8" });
    expect(out).toContain("Privacy check passed");
  });

  test("passes on a clean fixture", () => {
    const dir = fixture({ "a.ts": "export const x = 1;\n" });
    try {
      expect(run(dir).status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("fails when source makes its own network request", () => {
    for (const code of [
      'fetch("https://example.org/track");',
      "new WebSocket('wss://example.org');",
      "navigator.sendBeacon('/x', 'y');",
      "const r = new XMLHttpRequest();",
    ]) {
      const dir = fixture({ "bad.ts": code + "\n" });
      try {
        const res = run(dir);
        expect(res.status, code).toBe(1);
        expect(res.stderr).toContain("Privacy check FAILED");
        expect(res.stderr).toContain("bad.ts");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  test("fails on an external URL in source, and on a dependency that is not on the approved list", () => {
    const dir = fixture({ "u.ts": 'export const cdn = "https://cdn.example.org/lib.js";\n' });
    const dir2 = fixture({ "ok.ts": "export {};\n" }, ["react", "sneaky-analytics"], ["react"]);
    try {
      const a = run(dir);
      expect(a.status).toBe(1);
      expect(a.stderr).toContain("cdn.example.org");
      const b = run(dir2);
      expect(b.status).toBe(1);
      expect(b.stderr).toContain("sneaky-analytics");
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  test("fails when the built app loads something from another site or the CSP is weakened", () => {
    const dir = fixture({ "ok.ts": "export {};\n" });
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(
      join(dir, "dist", "index.html"),
      '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; connect-src \'self\' https://api.example.org"><script src="https://cdn.example.org/x.js"></script></head></html>'
    );
    try {
      const res = run(dir);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain("cdn.example.org");
      expect(res.stderr).toContain("allows outside hosts");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
