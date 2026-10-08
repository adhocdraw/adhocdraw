// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

test.describe("Multi-page diagrams", () => {
  test("starts with a single default page", async ({ diagramPage: page }) => {
    await expect(page.locator(".page-tab")).toHaveCount(1);
    await expect(page.locator(".page-tab-close")).toBeDisabled();
  });

  test("adding a page creates an empty, independent canvas", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    await page.getByRole("button", { name: "+ Page" }).click();
    await expect(page.locator(".page-tab")).toHaveCount(2);
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });

  test("switching pages preserves each page's content", async ({ diagramPage: page }) => {
    await addWidget(page, "Process");
    await page.getByRole("button", { name: "+ Page" }).click();
    await addWidget(page, "Decision");
    await addWidget(page, "Decision");

    await page.locator(".page-tab").first().locator("span").click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-shape")).toHaveCount(1);

    await page.locator(".page-tab").last().locator("span").click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
  });

  test("renaming a page via double-click updates its tab", async ({ diagramPage: page }) => {
    const tab = page.locator(".page-tab").first();
    await tab.locator("span").dblclick();
    const input = tab.locator("input");
    await input.fill("Overview");
    await input.press("Enter");
    await expect(tab.locator("span")).toHaveText("Overview");
  });

  test("dragging a page tab reorders the pages (no move buttons)", async ({ diagramPage: page, diagram }) => {
    await page.getByRole("button", { name: "+ Page" }).click();
    await page.getByRole("button", { name: "+ Page" }).click();
    const names = () => page.locator(".page-tab span").allTextContents();
    expect(await names()).toEqual(["Page 1", "Page 2", "Page 3"]);
    await expect(page.getByRole("button", { name: /^Move Page/ })).toHaveCount(0);

    // Drag Page 3 onto the left half of Page 1: it becomes the first tab.
    const first = page.locator(".page-tab").nth(0);
    await page.locator(".page-tab").nth(2).dragTo(first, { targetPosition: { x: 6, y: 10 } });
    await expect.poll(names).toEqual(["Page 3", "Page 1", "Page 2"]);

    // Drag Page 3 (now first) onto the right half of the last tab: it moves to the end.
    const last = page.locator(".page-tab").nth(2);
    const box = (await last.boundingBox())!;
    await page.locator(".page-tab").nth(0).dragTo(last, { targetPosition: { x: box.width - 6, y: box.height / 2 } });
    await expect.poll(names).toEqual(["Page 1", "Page 2", "Page 3"]);

    // The new order is saved: it survives a reload.
    await page.locator(".page-tab").nth(2).dragTo(page.locator(".page-tab").nth(0), { targetPosition: { x: 6, y: 10 } });
    await expect.poll(names).toEqual(["Page 3", "Page 1", "Page 2"]);
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
    await page.reload();
    await page.locator(".diagram-tab", { hasText: diagram.name }).click();
    await expect.poll(names).toEqual(["Page 3", "Page 1", "Page 2"]);
  });

  test("deleting a page removes it and falls back to another page; the last page can't be deleted", async ({
    diagramPage: page,
  }) => {
    await page.getByRole("button", { name: "+ Page" }).click();
    await expect(page.locator(".page-tab")).toHaveCount(2);

    await page.locator(".page-tab").nth(1).getByRole("button", { name: /Delete/ }).click();
    await expect(page.locator(".page-tab")).toHaveCount(1);
    await expect(page.locator(".page-tab-close")).toBeDisabled();
  });

  test("autosave persists every page's content and viewport, restored on reload", async ({
    diagramPage: page,
    diagram,
  }) => {
    await addWidget(page, "Process");
    await page.getByRole("button", { name: "+ Page" }).click();
    await addWidget(page, "Decision");
    await addWidget(page, "Decision");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await page.goto("/");
    await page.getByText(diagram.name, { exact: true }).click();
    await expect(page.locator(".page-tab")).toHaveCount(2);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    await page.locator(".page-tab").last().locator("span").click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
  });
});
