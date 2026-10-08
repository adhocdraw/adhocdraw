// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, mockFileSystemAccess, openDiagram, readDiagram } from "./helpers";

test.describe("Save to file / open from file", () => {
  test("Save to File writes the diagram as JSON with its name and page data, then overwrites the same file on save again", async ({
    page,
    diagram,
  }) => {
    await mockFileSystemAccess(page);
    await openDiagram(page, diagram.name);
    await addWidget(page, "Process");

    await page.getByRole("button", { name: "Save to file" }).click();
    await page.waitForFunction(() => Boolean((window as unknown as { __lastSavedFile?: unknown }).__lastSavedFile));
    const first = await page.evaluate(() => (window as unknown as { __lastSavedFile: { name: string; content: string } }).__lastSavedFile);
    expect(first.name).toMatch(/\.json$/);
    const parsed = JSON.parse(first.content);
    expect(typeof parsed.name).toBe("string");
    expect(Array.isArray(parsed.data.pages)).toBe(true);
    expect(parsed.data.pages[0].nodes).toHaveLength(1);
    expect(parsed.data.pages[0].nodes[0].type).toBe("shape");

    // A second save with a file handle already open (browser-fs-access keeps
    // it after the first native picker use) writes back without opening a
    // new picker - showSaveFilePicker must not be called again.
    await page.evaluate(() => {
      (window as unknown as { showSaveFilePicker: () => Promise<never> }).showSaveFilePicker = () => {
        throw new Error("showSaveFilePicker should not be called on a repeat save");
      };
    });
    await page.evaluate(() => {
      delete (window as unknown as { __lastSavedFile?: unknown }).__lastSavedFile;
    });
    await addWidget(page, "Decision");
    await page.getByRole("button", { name: "Save to file" }).click();
    await page.waitForFunction(() => Boolean((window as unknown as { __lastSavedFile?: unknown }).__lastSavedFile));
    const second = await page.evaluate(() => (window as unknown as { __lastSavedFile: { name: string; content: string } }).__lastSavedFile);
    expect(JSON.parse(second.content).data.pages[0].nodes).toHaveLength(2);
  });

  test("Open from file creates and opens a new diagram from a valid export", async ({ page, diagram }) => {
    await mockFileSystemAccess(page);
    await openDiagram(page, diagram.name);

    const exportedName = `imported-${Date.now()}`;
    const payload = {
      name: exportedName,
      data: {
        pages: [
          {
            id: "p1",
            name: "Page 1",
            nodes: [{ id: "n1", type: "shape", position: { x: 0, y: 0 }, data: { shape: "rectangle", text: "From file" } }],
            edges: [],
          },
        ],
      },
    };
    await page.evaluate((p) => {
      (window as unknown as { __mockOpenFile: { name: string; content: string } }).__mockOpenFile = {
        name: "diagram.json",
        content: JSON.stringify(p),
      };
    }, payload);

    await page.getByRole("button", { name: "Open from file" }).click();

    await expect(page.locator(".diagram-tab.active .diagram-tab-name")).toHaveText(exportedName);
    await expect(page.getByText("From file", { exact: true })).toBeVisible();
    await expect(page.getByText(exportedName, { exact: true })).toBeVisible();

    // The imported copy is in the browser's storage under its own name.
    expect(await readDiagram(page, exportedName)).toBeTruthy();
  });

  test("Open from file rejects a file that isn't a valid diagram export", async ({ page, diagram }) => {
    await mockFileSystemAccess(page);
    await openDiagram(page, diagram.name);
    const before = await page.locator(".diagram-tab").count();

    await page.evaluate(() => {
      (window as unknown as { __mockOpenFile: { name: string; content: string } }).__mockOpenFile = {
        name: "not-a-diagram.json",
        content: JSON.stringify({ hello: "world" }),
      };
    });

    await page.getByRole("button", { name: "Open from file" }).click();

    await expect(page.locator(".app-toast")).toContainText("doesn't look like a valid diagram export");
    await expect(page.locator(".diagram-tab")).toHaveCount(before);
  });
});
