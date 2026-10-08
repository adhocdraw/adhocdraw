// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import {
  DEFAULT_NAME,
  addWidget,
  createDiagramFromMenu,
  openDiagram,
  openNewDiagramMenu,
  readDiagram,
  seedDiagram,
} from "./helpers";

test("the page title is AdhocDraw", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("AdhocDraw");
});

test.describe("Diagram tabs and toolbar menus", () => {
  test("creates and opens a diagram via the New menu", async ({ page }) => {
    await page.goto("/");
    const name = `ui-created-${Date.now()}`;
    await createDiagramFromMenu(page, name);

    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(name);
    await expect(page.locator(".diagram-tab.active")).toContainText(name);
  });

  test("the New menu has no name box; new diagrams get unique default names", async ({ diagramPage: page }) => {
    try {
      const title = page.locator(".diagram-tab.active .diagram-tab-name");
      await expect(title).toBeVisible();
      await openNewDiagramMenu(page);
      await expect(page.locator(".new-diagram-flyout input")).toHaveCount(0);

      const names: string[] = [];
      for (let i = 0; i < 2; i++) {
        const prev = await title.innerText();
        if (i > 0) await openNewDiagramMenu(page);
        await page.locator(".flyout-item", { hasText: /^Blank Chart$/ }).click();
        // (the box is empty for a moment while the new diagram loads: wait for the name)
        await expect
          .poll(async () => {
            const v = await title.innerText();
            return v !== prev && /^Chart \d+$/.test(v);
          })
          .toBe(true);
        names.push(await title.innerText());
      }
      expect(names[0]).toMatch(/^Chart \d+$/);
      expect(names[1]).toMatch(/^Chart \d+$/);
      expect(names[1]).not.toBe(names[0]);

      // Each option names the diagram after itself.
      for (const [option, base] of [
        ["White Board", "White Board"],
        ["Notebook", "Notebook"],
      ]) {
        const prev = await title.innerText();
        await openNewDiagramMenu(page);
        await page.locator(".flyout-item", { hasText: new RegExp(`^${option}$`) }).click();
        // (the box is empty for a moment while the new diagram loads: wait for the name)
        await expect
          .poll(async () => {
            const v = await title.innerText();
            return v !== prev && new RegExp(`^${base} \\d+$`).test(v);
          })
          .toBe(true);
      }
      expect(DEFAULT_NAME.test(await title.innerText())).toBe(true);
    } finally {
    }
  });

  test("the New menu closes on Escape and on an outside click", async ({ diagramPage: page }) => {
    await openNewDiagramMenu(page);
    await page.keyboard.press("Escape");
    await expect(page.locator(".new-diagram-flyout")).toHaveCount(0);

    await openNewDiagramMenu(page);
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await expect(page.locator(".new-diagram-flyout")).toHaveCount(0);
  });

  test("closing a diagram removes its tab", async ({ page, diagram }) => {
    await page.goto("/");
    await expect(page.getByText(diagram.name, { exact: true })).toBeVisible();

    // An empty diagram closes straight away (nothing would be lost).
    await page.getByRole("button", { name: `Close ${diagram.name}` }).click();

    await expect(page.getByText(diagram.name, { exact: true })).toHaveCount(0);
  });

  test("clicking a diagram tab switches to it", async ({ page, diagram }) => {
    await page.goto("/");
    await page.getByText(diagram.name, { exact: true }).click();
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(diagram.name);
    await expect(page.locator(".diagram-tab.active")).toContainText(diagram.name);
  });

  test("there is no left navigation rail or side panel", async ({ diagramPage: page }) => {
    await expect(page.locator(".nav-rail")).toHaveCount(0);
    await expect(page.locator(".side-panel")).toHaveCount(0);
  });

  test("switching tabs right after an edit does not lose the edit", async ({ page, diagram }) => {
    await seedDiagram(page, `${diagram.name}-other`);
    try {
      await openDiagram(page, diagram.name);
      await addWidget(page, "Process");
      // Switch away immediately - well inside the autosave delay.
      await page.getByText(`${diagram.name}-other`, { exact: true }).click();
      await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(`${diagram.name}-other`);

      await page.getByText(diagram.name, { exact: true }).click();
      await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(diagram.name);
      await expect(page.locator(".react-flow__node")).toHaveCount(1);
    } finally {
    }
  });

  test("opens the diagram last worked on after a reload", async ({ page, diagram }) => {
    await seedDiagram(page, `${diagram.name}-second`);
    try {
      await openDiagram(page, `${diagram.name}-second`);
      await page.reload();
      await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(`${diagram.name}-second`);
      await expect(page.locator(".diagram-tab.active")).toContainText(`${diagram.name}-second`);

      await page.getByText(diagram.name, { exact: true }).click();
      await page.reload();
      await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(diagram.name);
    } finally {
    }
  });

  test("tabs keep their order - the last-worked diagram is not moved to the front", async ({ page, diagram }) => {
    await seedDiagram(page, `${diagram.name}-later`);
    try {
      const order = async () => (await page.locator(".diagram-tab-name").allInnerTexts());
      await openDiagram(page, `${diagram.name}-later`);
      await addWidget(page, "Process");
      await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });
      // Saving bumps the diagram's updated time; its tab must stay put.
      await page.reload();
      await expect(page.locator(".diagram-tab.active")).toContainText(`${diagram.name}-later`);
      const names = await order();
      expect(names.indexOf(diagram.name)).toBeGreaterThanOrEqual(0);
      expect(names.indexOf(diagram.name)).toBeLessThan(names.indexOf(`${diagram.name}-later`));
    } finally {
    }
  });

  // The tab list is shared with other tests running in parallel (their
  // diagrams come and go), so these only assert that a diagram opens by
  // itself and is highlighted, not exactly which one.
  test("with no remembered diagram, a diagram is opened automatically", async ({ page, diagram }) => {
    await page.goto("/");
    await expect(page.locator(".diagram-tab.active")).toBeVisible();
    expect(diagram.name).toBeTruthy();
  });

  test("closing the open diagram opens another tab instead of leaving a blank screen", async ({ page, diagram }) => {
    await seedDiagram(page, `${diagram.name}-spare`);
    await openDiagram(page, diagram.name);
    await page.getByRole("button", { name: `Close ${diagram.name}`, exact: true }).click();
    await expect(page.getByText(diagram.name, { exact: true })).toHaveCount(0);
    await expect(page.locator(".diagram-tab.active")).toBeVisible();
  });

  test("an overflowing tab strip has no padding or scrollbar of its own (bar as tall as its tabs); arrow buttons scroll it", async ({
    page,
    diagram,
  }) => {
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      ids.push(await seedDiagram(page, `${diagram.name}-overflow-tab-number-${i}`));
    }
    try {
      await page.goto("/");
      const strip = page.locator(".diagram-tabs");
      await expect(strip).toHaveCSS("scrollbar-width", "none");
      // No padding above/below the tabs: the bar is exactly as tall as a tab (plus its 1px border).
      const pad = await strip.evaluate((el) => {
        const c = getComputedStyle(el);
        return parseFloat(c.paddingTop) + parseFloat(c.paddingBottom);
      });
      expect(pad).toBe(0);
      const tabH = (await page.locator(".diagram-tab").first().boundingBox())!.height;
      const barH = (await page.locator(".diagram-tabs-wrap").boundingBox())!.height;
      expect(barH - tabH).toBeLessThanOrEqual(3);
      const scrollable = await strip.evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(scrollable).toBe(true);

      const right = page.getByRole("button", { name: "Scroll tabs right" });
      const left = page.getByRole("button", { name: "Scroll tabs left" });
      await expect(left).toBeDisabled();
      await expect(right).toBeEnabled();
      await right.click();
      await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);
      await expect(left).toBeEnabled();
    } finally {
    }
  });

  test("the selected tab keeps its blue color when hovered or focused", async ({ diagramPage: page }) => {
    const active = page.locator(".diagram-tab.active");
    const blue = await active.evaluate((el) => getComputedStyle(el).backgroundColor);
    await active.hover();
    await expect(active).toHaveCSS("background-color", blue);
    await active.locator(".diagram-tab-close").focus();
    await expect(active).toHaveCSS("background-color", blue);
    await active.locator(".diagram-tab-name").click();
    await expect(active).toHaveCSS("background-color", blue);
  });

  test("double-clicking a tab's name renames the diagram", async ({ diagramPage: page, diagram }) => {
    const newName = `${diagram.name}-renamed`;
    await page.locator(".diagram-tab.active .diagram-tab-name").dblclick();
    const input = page.getByRole("textbox", { name: `Rename ${diagram.name}` });
    await expect(input).toBeFocused();
    await input.fill(newName);
    await input.press("Enter");

    await expect(page.locator(".diagram-tab.active")).toContainText(newName);
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(newName);

    // The new name is what gets saved, not just what is on screen.
    await expect
      .poll(async () => (await readDiagram(page, diagram.id))?.name, {
        timeout: 8000,
      })
      .toBe(newName);
    await page.reload();
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(newName);
    await expect(page.getByText(newName, { exact: true })).toBeVisible();
  });

  test("Escape cancels a tab rename and an empty name is ignored", async ({ diagramPage: page, diagram }) => {
    const tabName = page.locator(".diagram-tab.active .diagram-tab-name");
    await tabName.dblclick();
    const input = page.getByRole("textbox", { name: `Rename ${diagram.name}` });
    await input.fill("should not stick");
    await input.press("Escape");
    await expect(tabName).toHaveText(diagram.name);

    await tabName.dblclick();
    await page.getByRole("textbox", { name: `Rename ${diagram.name}` }).fill("   ");
    await page.keyboard.press("Enter");
    await expect(tabName).toHaveText(diagram.name);
    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(diagram.name);
  });
});

test("every New and Export menu item has an icon", async ({ diagramPage: page }) => {
  await openNewDiagramMenu(page);
  const newItems = page.locator(".new-diagram-flyout .flyout-item");
  await expect(newItems).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(newItems.nth(i).locator("svg.toolbar-icon")).toHaveCount(1);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /^Export/ }).click();
  const exportItems = page.locator(".export-flyout .flyout-item");
  await expect(exportItems).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(exportItems.nth(i).locator("svg.toolbar-icon")).toHaveCount(1);
});

test("clicking a tab keeps the strip where it was and the selected tab stays visible", async ({ page, diagram }) => {
  const ids: string[] = [];
  for (let i = 0; i < 25; i++) {
    ids.push(await seedDiagram(page, `${diagram.name}-keep-scroll-${i}`));
  }
  try {
    await page.goto("/");
    const strip = page.locator(".diagram-tabs");
    const right = page.getByRole("button", { name: "Scroll tabs right" });
    // Scroll part-way along the strip.
    await right.click();
    await right.click();
    await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(300);
    await page.waitForTimeout(400);
    const before = await strip.evaluate((el) => el.scrollLeft);

    // Click several visible, non-active tabs: each becomes active and is on screen.
    for (let attempt = 0; attempt < 4; attempt++) {
      const visible = await page.locator(".diagram-tab:not(.active)").evaluateAll((els, sel) => {
        const s = document.querySelector(sel)!.getBoundingClientRect();
        return els
          .map((e, i) => ({ i, r: e.getBoundingClientRect() }))
          .filter((x) => x.r.left > s.left + 40 && x.r.right < s.right - 40)
          .map((x) => x.i);
      }, ".diagram-tabs");
      expect(visible.length).toBeGreaterThan(0);
      const pick = visible[Math.min(attempt, visible.length - 1)];
      await page.locator(".diagram-tab:not(.active)").nth(pick).locator(".diagram-tab-name").click();
      await expect(page.locator(".diagram-tab.active")).toHaveCount(1);
      await page.waitForTimeout(500);
      const onScreen = await page.evaluate(() => {
        const s = document.querySelector(".diagram-tabs")!.getBoundingClientRect();
        const t = document.querySelector(".diagram-tab.active")!.getBoundingClientRect();
        return t.left >= s.left - 1 && t.right <= s.right + 1;
      });
      expect(onScreen).toBe(true);
      // The strip did not jump back to the start (or far away) because of the click.
      const now = await strip.evaluate((el) => el.scrollLeft);
      expect(Math.abs(now - before)).toBeLessThan(260);
    }
  } finally {
  }
});
