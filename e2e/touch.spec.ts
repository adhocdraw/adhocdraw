// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { devices } from "@playwright/test";
import { test, expect } from "./fixtures";
import { addWidget, openShapesPanel } from "./helpers";

const vp_w_third = (w: number) => w / 3;

// A phone: touch input only, narrow screen. (iPhone browsers run WebKit, which
// Playwright can emulate only partly - there is no multi-point touch drag - so
// these run on a Chromium phone profile.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _ignored, ...phone } = devices["Pixel 7"];
test.use(phone);

async function touchDrag(page: import("@playwright/test").Page, x: number, y: number, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, pts: { x: number; y: number }[]) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  await send("touchStart", [{ x, y }]);
  for (let i = 1; i <= 10; i++) {
    await send("touchMove", [{ x: x + (dx * i) / 10, y: y + (dy * i) / 10 }]);
    await page.waitForTimeout(16);
  }
  await send("touchEnd", []);
}

test.describe("Touch screens", () => {
  test("a tap adds a shape from the Shapes panel and the hint says tap", async ({ diagramPage: page }) => {
    await openShapesPanel(page);
    await expect(page.locator(".shapes-hint")).toHaveText("Tap a shape to add it");
    const process = page.locator(".shapes-panel").getByRole("button", { name: "Process" });
    await process.tap();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    // A quick second tap on the same shape is a second, separate add - not a hidden double-add.
    await process.tap();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
  });

  test("drawing with a finger creates a freehand stroke", async ({ diagramPage: page }) => {
    await page.getByRole("button", { name: "Freehand" }).tap();
    await expect(page.getByRole("button", { name: "Freehand" })).toHaveClass(/active/);
    const box = await page.locator(".canvas-flow").boundingBox();
    if (!box) throw new Error("canvas not found");
    const before = await page.locator(".react-flow__viewport").getAttribute("style");
    await touchDrag(page, box.x + 100, box.y + 200, 150, 80);
    await expect(page.locator(".react-flow__node-freehand")).toHaveCount(1);
    // The finger drew; it did not pan the canvas.
    expect(await page.locator(".react-flow__viewport").getAttribute("style")).toBe(before);
  });

  test("double-tapping a shape edits its text", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    const box = await node.boundingBox();
    if (!box) throw new Error("node not found");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(x, y);
    await expect(node.locator("textarea, input, [contenteditable=true]").first()).toBeVisible();
  });

  test("pressing and holding a shape opens its menu", async ({ diagramPage: page }) => {
    const node = await addWidget(page, "Process");
    const box = await node.boundingBox();
    if (!box) throw new Error("node not found");
    const cdp = await page.context().newCDPSession(page);
    const pt = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
    await page.waitForTimeout(800);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.locator(".context-menu")).toBeVisible();
  });

  test("on a phone the toolbar is one swipeable row, the Shapes dock starts as a slim bar and the minimap is hidden", async ({
    diagramPage: page,
  }) => {
    // The fixtures pre-close the dock; clear that to see the true phone default.
    await page.evaluate(() => localStorage.removeItem("adhocdraw.shapesPanel"));
    await page.reload();
    const viewport = page.viewportSize()!;

    const header = page.locator(".canvas-header");
    await expect(header).toBeVisible();
    const h = await header.evaluate((el) => ({ height: el.clientHeight, scroll: el.scrollWidth, client: el.clientWidth }));
    expect(h.height).toBeLessThan(viewport.height / 4);
    expect(h.scroll).toBeGreaterThan(h.client);
    // Nothing makes the page itself scroll sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    const dock = page.locator(".shapes-dock");
    await expect(dock).toHaveClass(/collapsed/);
    const slim = (await dock.boundingBox())!;
    // Collapsed, it is a slim tab on the left edge with a vertical "Shapes" label.
    expect(slim.x).toBe(0);
    expect(slim.width).toBeLessThan(60);
    expect(slim.height).toBeLessThan(200);
    await expect(dock.locator(".shapes-dock-title-short")).toBeVisible();
    await expect(dock.locator(".shapes-dock-title-short")).toHaveText("Shapes");
    await expect(dock.locator(".shapes-dock-title-full")).toBeHidden();

    await dock.locator(".shapes-dock-collapse").tap();
    await expect(page.locator(".shapes-panel")).toBeVisible();
    await expect(dock.locator(".shapes-dock-close")).toBeHidden();
    const open = (await dock.boundingBox())!;
    expect(open.x).toBeGreaterThanOrEqual(0);
    expect(open.x + open.width).toBeLessThanOrEqual(viewport.width);
    expect(open.y + open.height).toBeLessThanOrEqual(viewport.height);
    const tools = (await page.locator(".tools-panel").boundingBox())!;
    expect(open.y + open.height).toBeLessThanOrEqual(tools.y + 1);
    // A narrow column down the left edge, above the tools panel, one shape below the other.
    expect(open.x).toBeLessThan(20);
    expect(open.width).toBeLessThan(vp_w_third(viewport.width));
    const a = (await page.locator(".shape-btn").nth(0).boundingBox())!;
    const b = (await page.locator(".shape-btn").nth(1).boundingBox())!;
    expect(Math.abs(a.x - b.x)).toBeLessThan(4);
    expect(b.y).toBeGreaterThan(a.y);
    expect(b.y - (a.y + a.height)).toBeLessThan(8);
    // No search box or "add custom shape" on a phone.
    await expect(page.locator(".shapes-search")).toBeHidden();
    await expect(page.locator(".custom-shape-upload-btn")).toBeHidden();

    await expect(page.locator(".react-flow__minimap")).toBeHidden();
  });

  test("on a phone the New menu opens in front of the tabs and inside the screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).tap();
    const menu = page.locator(".new-diagram-flyout");
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    // Whatever is on top at the menu's centre belongs to the menu (not the tab strip behind it).
    const onTop = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".new-diagram-flyout"), {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    expect(onTop).toBe(true);
    await page.locator(".flyout-item", { hasText: /^Blank Chart$/ }).tap();
    await expect(page.locator(".diagram-tab.active")).toBeVisible();
    // The tab keeps its full name next to the save status.
    const tab = (await page.locator(".diagram-tab.active .diagram-tab-name").boundingBox())!;
    expect(tab.width).toBeGreaterThan(30);
  });

  test("a new empty diagram starts at 25% on a phone", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).tap();
    await page.locator(".flyout-item", { hasText: /^Blank Chart$/ }).tap();
    await expect(page.locator(".controls-zoom-value")).toHaveText("25%");
  });

  test("on a phone the pencil options are compact: colours close together on one row with Auto and notebook lines, icons instead of words", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).tap();
    // A White Board opens ready to draw, so the pencil options are already showing.
    await page.locator(".flyout-item", { hasText: /^White Board$/ }).tap();
    const panel = page.locator(".pencil-panel");
    await expect(panel).toBeVisible();
    const vp = page.viewportSize()!;
    const box = (await panel.boundingBox())!;
    expect(box.width).toBeGreaterThan(vp.width - 24);
    expect(box.height).toBeLessThan(200);
    const first = (await panel.locator(".color-swatch").first().boundingBox())!;
    const last = (await panel.locator(".color-swatch").last().boundingBox())!;
    expect(Math.abs(first.y - last.y)).toBeLessThan(4);
    // Close together (no big gaps), with Auto and the colour picker on the same first row.
    expect(last.x + last.width - first.x).toBeLessThan(vp.width * 0.65);
    const auto = (await panel.locator(".pencil-auto").boundingBox())!;
    const picker = (await panel.getByLabel("Pencil color").boundingBox())!;
    expect(Math.abs(auto.y + auto.height / 2 - (first.y + first.height / 2))).toBeLessThan(14);
    expect(Math.abs(picker.y + picker.height / 2 - (first.y + first.height / 2))).toBeLessThan(14);
    // Notebook lines (White Board) joins that row on a normal phone width too.
    const nb = (await panel.getByRole("button", { name: "Notebook lines" }).boundingBox())!;
    expect(Math.abs(nb.y + nb.height / 2 - (first.y + first.height / 2))).toBeLessThan(14);
    // Thickness and opacity follow below.
    const thick = (await panel.getByLabel("Pencil thickness").boundingBox())!;
    expect(thick.y).toBeGreaterThan(first.y + first.height);
    await expect(panel.locator(".pencil-label").first()).toBeHidden();
    await expect(panel.locator(".pencil-label-icon").first()).toBeVisible();
    const slider = (await panel.getByLabel("Pencil thickness").boundingBox())!;
    expect(slider.width).toBeLessThan(70);
  });

  test("in focus mode on a phone the save status sits in the bottom row with the zoom controls", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).tap();
    await page.locator(".flyout-item", { hasText: /^White Board$/ }).tap();
    // The toolbar's own Focus button is hidden on phones; the tools panel has it.
    await page.getByRole("button", { name: "Edit full screen" }).tap();
    await expect(page.locator(".canvas-area")).toHaveClass(/focus/);
    await expect(page.locator(".pencil-panel")).toBeVisible();
    const status = (await page.locator(".diagram-tabs-status .save-status").boundingBox())!;
    const footer = (await page.locator(".canvas-footer").boundingBox())!;
    const zoom = (await page.locator(".canvas-footer-zoom").boundingBox())!;
    expect(status.y).toBeGreaterThanOrEqual(footer.y - 1);
    expect(status.y + status.height).toBeLessThanOrEqual(footer.y + footer.height + 1);
    expect(status.x + status.width).toBeLessThanOrEqual(zoom.x + 1);
    // ...and clear of the drawing palette.
    const panel = (await page.locator(".pencil-panel").boundingBox())!;
    expect(status.y).toBeGreaterThanOrEqual(panel.y + panel.height);
  });

  test("on a phone the Shapes dock shows shapes only, without labels", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("adhocdraw.shapesPanel"));
    await page.reload();
    await page.getByRole("button", { name: /^New/ }).tap();
    await page.locator(".flyout-item", { hasText: /^Blank Chart$/ }).tap();
    await page.locator(".shapes-dock-collapse").tap();
    await expect(page.locator(".shape-btn-label").first()).toBeHidden();
    await expect(page.locator(".shape-btn-icon").first()).toBeVisible();
    // Still reachable by name, one below the other and compact (little white space).
    await expect(page.getByRole("button", { name: "Process", exact: true })).toBeVisible();
    const a = (await page.locator(".shape-btn").nth(0).boundingBox())!;
    const c = (await page.locator(".shape-btn").nth(1).boundingBox())!;
    expect(Math.abs(a.x - c.x)).toBeLessThan(4);
    expect(c.y - (a.y + a.height)).toBeLessThan(8);
    expect(a.width).toBeLessThan(50);
    expect(a.height).toBeLessThan(44);
  });

  test("on a phone the toolbar drops the Draw group, Present, Focus and Shortcuts; the canvas tools panel has the tools", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).tap();
    await page.locator(".flyout-item", { hasText: /^White Board$/ }).tap();
    await expect(page.locator(".tools-panel")).toBeVisible();
    await expect(page.getByRole("group", { name: "Draw" })).toBeHidden();
    await expect(page.locator(".focus-mode-btn")).toBeHidden();
    await expect(page.locator(".present-btn")).toBeHidden();
    await expect(page.getByRole("button", { name: "Shortcuts" })).toBeHidden();
    // Find / History are still there; the tools panel carries the rest.
    await expect(page.getByRole("button", { name: "Find" })).toBeAttached();
    await expect(page.getByRole("button", { name: "Present full screen" })).toBeVisible();
    // The panel fits the screen, so Focus and Present can actually be reached.
    const vp = page.viewportSize()!;
    for (const name of ["Edit full screen", "Present full screen"]) {
      const b = (await page.getByRole("button", { name }).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
    }

    // A chart gets the same tools panel on a phone (without Focus, which is for boards),
    // and its toolbar drops the Draw group and Present too.
    await page.getByRole("button", { name: /^New/ }).tap();
    await page.locator(".flyout-item", { hasText: /^Blank Chart$/ }).tap();
    await expect(page.locator(".tools-panel")).toBeVisible();
    await expect(page.getByRole("button", { name: "Shape library" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Freehand" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Present full screen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit full screen" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Draw" })).toBeHidden();
    await expect(page.locator(".present-btn")).toBeHidden();
  });

  test("on a phone a chart's tools panel opens the Shapes dock above it, and Freehand shows the pencil options", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).tap();
    await page.locator(".flyout-item", { hasText: /^Blank Chart$/ }).tap();
    await page.getByRole("button", { name: "Shape library" }).tap();
    await expect(page.locator(".shapes-panel")).toBeVisible();
    const dock = (await page.locator(".shapes-dock").boundingBox())!;
    const tools = (await page.locator(".tools-panel").boundingBox())!;
    expect(dock.y + dock.height).toBeLessThanOrEqual(tools.y + 1);
    await page.getByRole("button", { name: "Freehand" }).tap();
    await expect(page.locator(".pencil-panel")).toBeVisible();
  });

  test("on a phone the toolbar scrolls sideways by swiping, and the tools panel does too while drawing", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^New/ }).tap();
    await page.locator(".flyout-item", { hasText: /^White Board$/ }).tap();
    const header = page.locator(".canvas-header");
    const scroll = () => header.evaluate((el) => el.scrollLeft);
    await expect.poll(() => header.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await scroll()).toBe(0);
    await touchDrag(page, 300, 40, -200, 0);
    await expect.poll(scroll).toBeGreaterThan(50);
    // The page itself does not move sideways.
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
    // The pencil is on in a White Board; that must not freeze the tools panel's own swipe.
    expect(await page.locator(".tools-panel").evaluate((el) => getComputedStyle(el).touchAction)).toBe("pan-x");
  });

  test("on a phone the Shapes tab expands and collapses by tapping it, and the pane stays open after adding a shape", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("adhocdraw.shapesPanel"));
    await page.reload();
    await page.getByRole("button", { name: /^New/ }).tap();
    await page.locator(".flyout-item", { hasText: /^Blank Chart$/ }).tap();
    const dock = page.locator(".shapes-dock");
    await expect(dock).toHaveClass(/collapsed/);
    await dock.locator(".shapes-dock-collapse").tap();
    await expect(dock).not.toHaveClass(/collapsed/);
    await page.getByRole("button", { name: "Process", exact: true }).tap();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    // No auto-collapse: ready for the next shape.
    await expect(dock).not.toHaveClass(/collapsed/);
    await page.getByRole("button", { name: "Decision", exact: true }).tap();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await dock.locator(".shapes-dock-collapse").tap();
    await expect(dock).toHaveClass(/collapsed/);
  });

});
