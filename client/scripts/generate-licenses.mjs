// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

// Writes THIRD_PARTY_LICENSES.txt: every production dependency with its
// license and license text, so the hosted build can ship the notices that
// MIT/BSD/Apache licenses ask to be kept. Run: npm run licenses
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dirs = execSync("npm ls --omit=dev --all --parseable", { maxBuffer: 1e8 })
  .toString()
  .split("\n")
  .filter((d) => d.includes("node_modules"));

const seen = new Map();
for (const dir of dirs) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    continue;
  }
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) continue;
  const files = readdirSync(dir).filter((f) => /^(licen[sc]e|copying|notice)/i.test(f));
  const text = files.map((f) => readFileSync(join(dir, f), "utf8").trim()).join("\n\n");
  const license =
    typeof pkg.license === "string" ? pkg.license : pkg.license?.type ?? pkg.licenses?.map((l) => l.type).join(" OR ") ?? (/apache license/i.test(text) ? "Apache-2.0" : "UNKNOWN");
  const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url ?? pkg.homepage ?? "";
  seen.set(key, { key, license, repo, text });
}

const entries = [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));
const out = [
  "Third-party software included in this application",
  "==================================================",
  "",
  "This application is built with the open-source packages below. Each is",
  "used under its own license, reproduced here.",
  "",
  `${entries.length} packages`,
  "",
  ...entries.flatMap((e) => [
    "--------------------------------------------------------------------------------",
    `${e.key}`,
    `License: ${e.license}`,
    e.repo ? `Source: ${e.repo}` : "",
    "",
    e.text || "(No license file shipped with this package; see the license named above.)",
    "",
  ]),
].join("\n");

writeFileSync(new URL("../THIRD_PARTY_LICENSES.txt", import.meta.url), out);
const unknown = entries.filter((e) => e.license === "UNKNOWN");
console.log(`Wrote ${entries.length} packages${unknown.length ? `; UNKNOWN: ${unknown.map((e) => e.key).join(", ")}` : ""}`);
