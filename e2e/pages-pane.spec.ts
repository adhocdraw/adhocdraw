// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { createDiagramFromMenu } from "./helpers";

test.describe("Canvas footer: page tabs on the left, zoom on the right", () => {
  test("the footer sits under the canvas with the page tabs at its left and the zoom controls at its right", async ({
    diagramPage: page,
  }) => {
    const footer = (await page.locator(".canvas-footer").boundingBox())!;
    const flow = (await page.locator(".canvas-flow").boundingBox())!;
    const tabs = (await page.locator(".canvas-footer .page-tabs").boundingBox())!;
    const zoom = (await page.locator(".canvas-footer .react-flow__controls").boundingBox())!;
    // Below the canvas, not over it.
    expect(footer.y).toBeGreaterThanOrEqual(flow.y + flow.height - 1);
    // Tabs at the left end, zoom at the right end, one row.
    expect(tabs.x - footer.x).toBeLessThan(40);
    expect(footer.x + footer.width - (zoom.x + zoom.width)).toBeLessThan(40);
    expect(zoom.x).toBeGreaterThan(tabs.x + 100);
    expect(zoom.width).toBeGreaterThan(zoom.height * 2); // a horizontal row
    expect(Math.abs(zoom.y + zoom.height / 2 - (tabs.y + tabs.height / 2))).toBeLessThan(14);
  });

  test("pages work from the footer tabs: add, switch, rename and delete", async ({ diagramPage: page }) => {
    await expect(page.locator(".canvas-footer .page-tab")).toHaveCount(1);
    await page.getByRole("button", { name: "+ Page" }).click();
    await expect(page.locator(".canvas-footer .page-tab")).toHaveCount(2);
    await expect(page.locator(".page-tab.active")).toContainText("Page 2");
    await page.locator(".page-tab").first().locator("span").click();
    await expect(page.locator(".page-tab.active")).toContainText("Page 1");
  });

  test("the zoom buttons in the footer zoom the canvas", async ({ diagramPage: page }) => {
    const zoom = () =>
      page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    const before = await zoom();
    await page.locator(".canvas-footer .react-flow__controls-zoomin").click();
    await expect.poll(zoom).toBeGreaterThan(before);
    const mid = await zoom();
    await page.locator(".canvas-footer .react-flow__controls-zoomout").click();
    await expect.poll(zoom).toBeLessThan(mid);
  });

  test("a White Board has no paging, but keeps the zoom controls in the footer", async ({ page }) => {
    await page.goto("/");
    await createDiagramFromMenu(page, `wb-nopages-${Date.now()}`, "White Board");
    await expect(page.locator(".canvas-footer")).toBeVisible();
    await expect(page.locator(".canvas-footer .page-tabs")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ Page" })).toHaveCount(0);
    await expect(page.locator(".canvas-footer .react-flow__controls")).toBeVisible();
    // A Blank Chart (and a Notebook) still page.
    await createDiagramFromMenu(page, `chart-pages-${Date.now()}`, "Blank Chart");
    await expect(page.locator(".canvas-footer .page-tabs")).toBeVisible();
    await createDiagramFromMenu(page, `nb-pages-${Date.now()}`, "Notebook");
    await expect(page.locator(".canvas-footer .page-tabs")).toBeVisible();
  });

  test("the Shapes dock can use the full canvas height and the footer never overlaps it", async ({
    diagramPage: page,
  }) => {
    await page.locator(".shapes-toggle").click();
    const dock = (await page.locator(".shapes-dock").boundingBox())!;
    const footer = (await page.locator(".canvas-footer").boundingBox())!;
    expect(dock.y + dock.height).toBeLessThanOrEqual(footer.y + 1);
  });

  test("the footer zoom row has no Present button any more (it lives in the tools panel and the toolbar)", async ({
    diagramPage: page,
  }) => {
    await expect(page.locator(".canvas-footer .controls-present")).toHaveCount(0);
    await expect(page.locator(".canvas-footer").getByRole("button", { name: /^Present/ })).toHaveCount(0);
    // Zoom row: + 100% - fit lock.
    const x = async (sel: string) => (await page.locator(sel).boundingBox())!.x;
    expect(await x(".canvas-footer .react-flow__controls-fitview")).toBeLessThan(
      await x(".canvas-footer .react-flow__controls-interactive")
    );
  });

  test("page tabs can be dragged to reorder when pages are empty, and dropped in the gap past the last tab", async ({
    diagramPage: page,
  }) => {
    await page.getByRole("button", { name: "+ Page" }).click();
    await page.getByRole("button", { name: "+ Page" }).click(); // three empty pages
    const names = () => page.locator(".page-tab span").allTextContents();
    const list = page.locator(".canvas-footer .page-tabs-list");
    // Drop Page 1 on the empty space of the strip, past the last tab: it goes to the end.
    const lb = (await list.boundingBox())!;
    await page.locator(".page-tab").nth(0).dragTo(list, { targetPosition: { x: lb.width - 4, y: lb.height / 2 } });
    await expect.poll(names).toEqual(["Page 2", "Page 3", "Page 1"]);
    // And onto the left half of the first tab: it goes to the front.
    await page.locator(".page-tab").nth(2).dragTo(page.locator(".page-tab").nth(0), { targetPosition: { x: 4, y: 10 } });
    await expect.poll(names).toEqual(["Page 1", "Page 2", "Page 3"]);
  });
});

test("the footer zoom row shows the zoom percentage between + and -, follows zooming, and resets to 100% on click", async ({
  diagramPage: page,
}) => {
  const x = async (sel: string) => (await page.locator(sel).boundingBox())!.x;
  const plus = await x(".canvas-footer .react-flow__controls-zoomin");
  const value = await x(".canvas-footer .controls-zoom-value");
  const minus = await x(".canvas-footer .react-flow__controls-zoomout");
  expect(value).toBeGreaterThan(plus);
  expect(minus).toBeGreaterThan(value);

  const label = page.locator(".canvas-footer .controls-zoom-value");
  const actual = () =>
    page.locator(".react-flow__viewport").evaluate((el) => Math.round(new DOMMatrix(getComputedStyle(el).transform).a * 100));
  // (both change during the zoom animation, so compare once it has settled)
  await expect
    .poll(async () => Math.abs(Number((await label.textContent())!.replace("%", "")) - (await actual())), { timeout: 5000 })
    .toBeLessThanOrEqual(1);

  await page.locator(".canvas-footer .react-flow__controls-zoomout").click();
  await expect.poll(actual).toBeLessThan(100);
  // (both change during the zoom animation, so compare once it has settled)
  await expect
    .poll(async () => Math.abs(Number((await label.textContent())!.replace("%", "")) - (await actual())), { timeout: 5000 })
    .toBeLessThanOrEqual(1);

  await label.click();
  await expect(label).toHaveText("100%");
});

test("the zoom buttons step through preset levels: 100, 110, 125, 150, 175, 200 and back down", async ({
  diagramPage: page,
}) => {
  const label = page.locator(".canvas-footer .controls-zoom-value");
  await label.click();
  await expect(label).toHaveText("100%");
  const plus = page.locator(".canvas-footer .react-flow__controls-zoomin");
  const minus = page.locator(".canvas-footer .react-flow__controls-zoomout");
  for (const expected of ["110%", "125%", "150%", "175%", "200%"]) {
    await plus.click();
    await expect(label).toHaveText(expected);
  }
  for (const expected of ["175%", "150%", "125%", "110%", "100%", "90%", "80%"]) {
    await minus.click();
    await expect(label).toHaveText(expected);
  }
  // From an in-between zoom (e.g. after a wheel zoom) the next step is the next preset.
  await page.keyboard.press("Control+=");
  await expect(label).toHaveText("90%");
});

test("the footer is as tall as its page tabs (no padding around them)", async ({ diagramPage: page }) => {
  const footer = (await page.locator(".canvas-footer").boundingBox())!;
  const tab = (await page.locator(".canvas-footer .page-tab").first().boundingBox())!;
  expect(footer.height - tab.height).toBeLessThanOrEqual(3);
});
