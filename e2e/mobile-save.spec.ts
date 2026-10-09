// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { openShapesPanel, readDiagram, createDiagramFromMenu } from "./helpers";

test.describe("Saving where there is no file-save dialog (phones, Firefox, Safari)", () => {
  test.beforeEach(async ({ page }) => {
    // The same situation as a phone browser: no File System Access API, so
    // "Save to file" falls back to a download.
    await page.addInitScript(() => {
      delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
      delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
    });
  });

  test("Save to file downloads a .json and says where to find it", async ({ page }) => {
    await page.goto("/");
    const name = `dl-${Date.now()}`;
    await createDiagramFromMenu(page, name);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Save to file/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`${name}.json`);
    await expect(page.locator(".app-toast").filter({ hasText: "Downloaded" })).toContainText(
      "Downloads folder or the Files app"
    );
  });

  test("an edit is written to the browser as soon as the page is hidden, without waiting out the autosave delay", async ({
    page,
  }) => {
    await page.goto("/");
    const name = `flush-${Date.now()}`;
    await createDiagramFromMenu(page, name);
    await expect.poll(async () => !!(await readDiagram(page, name))).toBe(true);
    await openShapesPanel(page);
    await page.locator(".shapes-panel").getByRole("button", { name: "Process" }).dblclick();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    // Straight away (well inside the 600 ms autosave delay): the page goes to the background.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect
      .poll(async () => (await readDiagram(page, name))?.data.pages?.[0]?.nodes?.length ?? 0, { timeout: 400 })
      .toBe(1);
  });
});
