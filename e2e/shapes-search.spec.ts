// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { openShapesPanel } from "./helpers";

test.describe("Shapes panel search", () => {
  test("filters the widget list as the user types, and clearing restores it", async ({ diagramPage: page }) => {
    await openShapesPanel(page);
    // The panel now animates in (T7) rather than mounting instantly, so
    // wait for its content before counting - a bare .count() doesn't
    // retry like expect(...).toHaveCount() does.
    await expect(page.getByPlaceholder("Search shapes")).toBeVisible();
    const fullCount = await page.locator(".shape-btn").count();
    expect(fullCount).toBeGreaterThan(1);

    await page.getByPlaceholder("Search shapes").fill("cloud");
    await expect(page.locator(".shape-btn")).toHaveCount(1);
    await expect(page.locator(".shapes-panel").getByRole("button", { name: "Cloud" })).toBeVisible();

    await page.getByPlaceholder("Search shapes").fill("");
    await expect(page.locator(".shape-btn")).toHaveCount(fullCount);
  });

  test("shows an empty-state message when no shape matches", async ({ diagramPage: page }) => {
    await openShapesPanel(page);
    await page.getByPlaceholder("Search shapes").fill("zzznotashape");
    await expect(page.locator(".shape-btn")).toHaveCount(0);
    await expect(page.locator(".shapes-empty")).toBeVisible();
  });

  test("tolerates a missed keystroke", async ({ diagramPage: page }) => {
    await openShapesPanel(page);
    // "prcess" (no "o") is still a subsequence of "Process".
    await page.getByPlaceholder("Search shapes").fill("prcess");
    await expect(page.locator(".shape-btn")).toHaveCount(1);
    await expect(page.locator(".shapes-panel").getByRole("button", { name: "Process" })).toBeVisible();
  });

  test("matches regardless of word order", async ({ diagramPage: page }) => {
    await openShapesPanel(page);
    await page.getByPlaceholder("Search shapes").fill("end start");
    await expect(page.locator(".shape-btn")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Start / End" })).toBeVisible();
  });

  test("ranks a prefix match before other matches for the same letter", async ({ diagramPage: page }) => {
    await openShapesPanel(page);
    await page.getByPlaceholder("Search shapes").fill("s");
    const labels = await page.locator(".shape-btn .shape-btn-label").allTextContents();
    // Server, Swimlane, and Sticky Note all start with "s" - everything
    // else here only contains an "s" somewhere inside the label - so all
    // three should lead the ranked list, ahead of any of those.
    const prefixMatches = ["Server", "Swimlane", "Sticky Note"];
    expect(labels.slice(0, prefixMatches.length).sort()).toEqual([...prefixMatches].sort());
  });
});
