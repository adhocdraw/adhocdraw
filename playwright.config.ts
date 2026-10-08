// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Canvas-drag interactions occasionally miss in headless automation (real
  // browser timing noise); a full test retry with a fresh page usually clears it.
  retries: 2,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  // The built app, served as plain static files - exactly what gets published.
  webServer: {
    command: "cd client && npm run build && npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
