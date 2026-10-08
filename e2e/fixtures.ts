// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test as base, type Page } from "@playwright/test";
import { openDiagram, seedDiagram } from "./helpers";

interface Diagram {
  id: string;
  name: string;
}

export const test = base.extend<{ diagram: Diagram; diagramPage: Page }>({
  page: async ({ page }, use) => {
    // Leaving or reloading the page with work that is not in a file asks for
    // confirmation (a beforeunload prompt); accept it so reloads in tests go through.
    page.on("dialog", (d) => d.accept());
    // The Shapes panel is open by default on charts (and floats over the left of
    // the canvas); start every test with it closed so it doesn't sit on top of the
    // shapes and drags a test sets up. Tests about the panel itself clear this.
    await page.addInitScript(() => {
      try {
        // Only on the very first load of a test's browser context, so a test
        // can clear the setting and reload to see the true default.
        if (!localStorage.getItem("e2e.shapesPanelSeeded")) {
          localStorage.setItem("e2e.shapesPanelSeeded", "1");
          localStorage.setItem("adhocdraw.shapesPanel", JSON.stringify({ open: false, collapsed: false }));
        }
      } catch {
        // storage unavailable
      }
    });
    await use(page);
  },
  // A diagram already in the browser's storage (each test has its own empty
  // browser, so nothing needs cleaning up afterwards).
  diagram: async ({ page }, use) => {
    const name = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/");
    const id = await seedDiagram(page, name);
    await use({ id, name });
  },
  diagramPage: async ({ page, diagram }, use) => {
    await openDiagram(page, diagram.name);
    await use(page);
  },
});

export { expect } from "@playwright/test";
