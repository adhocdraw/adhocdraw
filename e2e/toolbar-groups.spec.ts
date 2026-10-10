// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { seedDiagram } from "./helpers";

const names = (group: import("@playwright/test").Locator) =>
  group.evaluate((el) =>
    Array.from(el.querySelectorAll(":scope > button, :scope > .flyout > .flyout-trigger, :scope > label")).map((n) =>
      (n.textContent ?? "").replace(/[▾]/g, "").trim()
    )
  );

const labels = (group: import("@playwright/test").Locator) =>
  group.evaluate((el) =>
    Array.from(el.querySelectorAll(":scope > button")).map(
      (n) => n.getAttribute("aria-label") ?? (n.textContent ?? "").trim()
    )
  );

test.describe("Toolbar grouping and visibility", () => {
  test("related buttons are grouped: file, draw/arrange, view", async ({ diagramPage: page }) => {
    const file = page.getByRole("group", { name: "File" });
    const draw = page.getByRole("group", { name: "Draw" });
    const view = page.getByRole("group", { name: "View and present" });
    const app = page.getByRole("group", { name: "App" });

    expect(await names(file)).toEqual(["New", "Open from file", "Save to file", "Export"]);
    expect(await names(draw)).toEqual(["Shapes", "Hand", "Select", "Pencil", "Eraser", "Text", "Snap to grid"]);
    // History, Find and Present are icon-only: names come from their aria-labels.
    expect(await labels(view)).toEqual(["History", "Find", "Present"]);
    expect(await labels(app)).toEqual(["Dark mode", "Theme: Classic", "Shortcuts", "AdhocDraw on GitHub", "About"]);
  });

  test("each group is a visibly separate container, in order, on the toolbar row", async ({ diagramPage: page }) => {
    const boxes = [];
    for (const name of ["File", "Draw", "View and present"]) {
      const b = await page.getByRole("group", { name }).boundingBox();
      if (!b) throw new Error(`${name} group not visible`);
      boxes.push(b);
    }
    // In order: each group is to the right of the previous one, or (when the
    // window is too narrow for one row) on the next row.
    for (let i = 1; i < boxes.length; i++) {
      const toTheRight = boxes[i].x >= boxes[i - 1].x + boxes[i - 1].width - 1;
      const nextRow = boxes[i].y >= boxes[i - 1].y + boxes[i - 1].height - 1;
      expect(toTheRight || nextRow).toBe(true);
    }
    const bg = await page.getByRole("group", { name: "File" }).evaluate((el) => getComputedStyle(el).backgroundColor);
    // Classic light: outlined only, no fill.
    expect(bg).toBe("rgba(0, 0, 0, 0)");
    const border = await page.getByRole("group", { name: "File" }).evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
    expect(border).toBeGreaterThanOrEqual(1);
  });

  test("buttons have a clearly visible border and shadow", async ({ diagramPage: page }) => {
    const btn = page.getByRole("button", { name: "Open from file" });
    const style = await btn.evaluate((el) => {
      const c = getComputedStyle(el);
      return { border: c.borderTopColor, width: parseFloat(c.borderTopWidth), shadow: c.boxShadow };
    });
    expect(style.width).toBeGreaterThanOrEqual(1);
    expect(style.shadow).not.toBe("none");
    // A mid-tone border, not a barely-there light grey.
    const [r, g, b] = style.border.match(/\d+/g)!.map(Number);
    expect(Math.min(r, g, b)).toBeLessThan(200);
  });

  test("the selected diagram tab stands apart from the others", async ({ diagramPage: page }) => {
    await seedDiagram(page, "e2e-other-tab");
    await page.reload();
    await expect(page.locator(".diagram-tab")).toHaveCount(2);
    const active = page.locator(".diagram-tab.active");
    const other = page.locator(".diagram-tab:not(.active)").first();
    const a = await active.evaluate((el) => getComputedStyle(el).backgroundImage + getComputedStyle(el).backgroundColor);
    const o = await other.evaluate((el) => getComputedStyle(el).backgroundImage + getComputedStyle(el).backgroundColor);
    expect(a).not.toBe(o);
    const borderW = await other.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
    expect(borderW).toBeGreaterThanOrEqual(1);
  });

  test("the empty start screen groups New / Open from file too", async ({ page }) => {
    await page.goto("/");
    // (a diagram opens automatically when any exist, so just check the group is there)
    await expect(page.getByRole("group", { name: "File" })).toBeVisible();
  });

  test("each group has its own border color and a small caption", async ({ diagramPage: page }) => {
    const colors: string[] = [];
    for (const name of ["File", "Draw", "View and present"]) {
      colors.push(await page.getByRole("group", { name }).evaluate((el) => getComputedStyle(el).borderTopColor));
    }
    expect(new Set(colors).size).toBe(3);

    await expect(page.locator(".toolbar-caption")).toHaveText(["File", "Draw", "View"]);
    const size = await page.locator(".toolbar-caption").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeLessThanOrEqual(11);
  });

  test("toolbar icons are colored by purpose, not all one color", async ({ diagramPage: page }) => {
    const icon = (cls: string) =>
      page.locator(`.toolbar-group .${cls}`).first().evaluate((el) => getComputedStyle(el).color);
    const colors = await Promise.all(
      ["icon-newDiagram", "icon-folder", "icon-save", "icon-export", "icon-shapes", "icon-pencil", "icon-history", "icon-present"].map(icon)
    );
    expect(new Set(colors).size).toBe(colors.length);
    // The "create" icon is green-dominant, the pencil orange (red > blue).
    const [r, g, b] = colors[0].match(/\d+/g)!.map(Number);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    const [pr, , pb] = colors[5].match(/\d+/g)!.map(Number);
    expect(pr).toBeGreaterThan(pb + 100);
  });

  test("the lines under the diagram tabs and page tabs are thin and not the strong blue", async ({
    diagramPage: page,
  }) => {
    const line = await page.locator(".diagram-tabs-wrap").evaluate((el) => {
      const c = getComputedStyle(el);
      return { width: parseFloat(c.borderBottomWidth), color: c.borderBottomColor };
    });
    expect(line.width).toBeLessThanOrEqual(1.01);
    const [r, , b] = line.color.match(/\d+/g)!.map(Number);
    expect(b - r).toBeLessThan(60); // a neutral grey-blue, not saturated blue
  });
});

test("mode, theme and Shortcuts are icon-only (name kept for assistive tech and tooltips)", async ({
  diagramPage: page,
}) => {
  for (const name of ["Dark mode", "Theme: Classic", "Shortcuts"]) {
    const btn = page.getByRole("button", { name, exact: true });
    await expect(btn).toBeVisible();
    expect(((await btn.textContent()) ?? "").trim(), name).toBe("");
    await expect(btn.locator("svg.toolbar-icon")).toHaveCount(1);
  }
  // Other buttons keep their text.
  expect(((await page.getByRole("button", { name: "About" }).textContent()) ?? "").trim()).toBe("About");
});

test("the header does not change height when the save status changes", async ({ diagramPage: page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const header = page.locator(".canvas-header");
  const before = (await header.boundingBox())!.height;
  await page.locator(".pencil-btn").click();
  const c = (await page.locator(".canvas-flow").boundingBox())!;
  await page.mouse.move(c.x + 200, c.y + 200);
  await page.mouse.down();
  await page.mouse.move(c.x + 300, c.y + 260, { steps: 5 });
  await page.mouse.up();
  // "Unsaved changes" / "Saving..." / "Saved" each show along the way.
  for (let i = 0; i < 6; i++) {
    expect(Math.abs((await header.boundingBox())!.height - before)).toBeLessThan(2);
    await page.waitForTimeout(250);
  }
});

test("brand, File / Draw / View groups and the app buttons share one toolbar row on a wide window", async ({
  diagramPage: page,
}) => {
  await page.setViewportSize({ width: 1600, height: 800 });
  const title = (await page.locator(".brand").boundingBox())!;
  const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
  const boxes = [title];
  for (const name of ["File", "Draw", "View and present", "App"]) {
    boxes.push((await page.getByRole("group", { name }).boundingBox())!);
  }
  for (const b of boxes) expect(Math.abs(mid(b) - mid(title))).toBeLessThan(25);
  // Compact: the whole header is one row tall.
  expect((await page.locator(".canvas-header").boundingBox())!.height).toBeLessThan(80);
  // The save status is in the tab pane, not the toolbar.
  await expect(page.locator(".canvas-header .save-status")).toHaveCount(0);
  await expect(page.locator(".diagram-tabs-wrap .save-status")).toHaveCount(1);
});

test.describe("Responsive toolbar: labels give way to icons when there is no room", () => {
  const visibleLabels = (page: import("@playwright/test").Page, group: string) =>
    page.getByRole("group", { name: group, exact: true }).evaluate((el) =>
      Array.from(el.querySelectorAll<HTMLElement>(".btn-label"))
        .filter((l) => l.offsetWidth > 0)
        .map((l) => (l.textContent ?? "").trim())
    );

  test("wide window: every toolbar button shows its label, including the View group", async ({ diagramPage: page }) => {
    await page.setViewportSize({ width: 1900, height: 800 });
    expect(await visibleLabels(page, "View and present")).toEqual(["History", "Find", "Present"]);
    expect(await visibleLabels(page, "Draw")).toEqual(["Shapes", "Hand", "Select", "Pencil", "Eraser", "Text", "Snap to grid"]);
    expect((await visibleLabels(page, "File")).length).toBe(4);
    // One row.
    expect((await page.locator(".canvas-header").boundingBox())!.height).toBeLessThan(80);
  });

  test("a medium window keeps File labels and drops the View and Draw labels (icons only)", async ({ diagramPage: page }) => {
    await page.setViewportSize({ width: 1300, height: 800 });
    expect(await visibleLabels(page, "View and present")).toEqual([]);
    expect(await visibleLabels(page, "Draw")).toEqual([]);
    expect((await visibleLabels(page, "File")).length).toBe(4);
  });

  test("a narrow window shows icons only everywhere, and every button keeps its name and a tooltip", async ({
    diagramPage: page,
  }) => {
    await page.setViewportSize({ width: 1050, height: 800 });
    for (const group of ["File", "Draw", "View and present", "App"]) {
      expect(await visibleLabels(page, group), group).toEqual([]);
    }
    // Names survive (aria-labels) so screen readers and tests still find every button...
    for (const name of ["New", "Open from file", "Save to file", "Export", "Shapes", "Hand", "Select", "Pencil", "History", "Find", "Present", "About"]) {
      await expect(page.getByRole("button", { name, exact: true }), name).toBeVisible();
    }
    // ...and an icon-only button shows a tooltip with its name.
    await expect(async () => {
      await page.mouse.move(5, 300);
      await page.getByRole("button", { name: "Open from file", exact: true }).hover();
      await expect(page.locator(".app-tooltip")).toContainText("Open a diagram from a file", { timeout: 1500 });
    }).toPass({ timeout: 8000 });
  });
});

test("a GitHub icon button sits right before About, opens the project repo in a new tab, and is icon-only", async ({
  diagramPage: page,
}) => {
  const app = page.getByRole("group", { name: "App", exact: true });
  const names = await app.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(names.slice(-2)).toEqual(["AdhocDraw on GitHub", "About"]);

  const gh = page.getByRole("button", { name: "AdhocDraw on GitHub" });
  expect(((await gh.textContent()) ?? "").trim()).toBe("");
  await expect(gh.locator("svg.toolbar-icon")).toHaveCount(1);

  // The click only opens a new tab (stubbed here so the test needs no internet).
  await page.context().route("https://github.com/**", (route) => route.fulfill({ body: "ok", contentType: "text/plain" }));
  const [popup] = await Promise.all([page.waitForEvent("popup"), gh.click()]);
  expect(popup.url()).toBe("https://github.com/adhocdraw/adhocdraw");
  await popup.close();
});
