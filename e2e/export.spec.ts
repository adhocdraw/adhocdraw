// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { readFile } from "node:fs/promises";
import { addWidget, dragHandle, openExportMenu, settleLayout, spreadNodes } from "./helpers";

test.describe("Export", () => {
  test("exports the diagram as a PNG download", async ({ diagramPage: page }) => {
    await addWidget(page, "Sticky Note");
    await openExportMenu(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export PNG" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test("exports the diagram as an SVG download", async ({ diagramPage: page }) => {
    await addWidget(page, "Sticky Note");
    await openExportMenu(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export SVG" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
  });

  test("exports the diagram as a PDF download", async ({ diagramPage: page }) => {
    await addWidget(page, "Sticky Note");
    await openExportMenu(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export PDF" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  // Regression: arrows used to export with no line (their color comes from a
  // CSS variable outside the exported subtree) and without the custom
  // crow's-foot markers, and the file included selection handles.
  test("an exported SVG draws arrows (line + arrowheads) and leaves out selection handles", async ({
    diagramPage: page,
  }) => {
    const a = await addWidget(page, "Process");
    const b = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [a, b]);
    await dragHandle(page, a, "right", b, "left");
    await page.locator(".react-flow__edge").click({ force: true });
    await page.locator(".edge-style-panel label", { hasText: "Start" }).locator("select").selectOption("crow-many");
    await page.locator(".edge-style-panel label", { hasText: "Line" }).locator("select").selectOption("dashed");
    await a.click(); // leave something selected: its handles must not be exported

    await openExportMenu(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export SVG" }).click(),
    ]);
    const svg = await readFile((await download.path())!, "utf8");

    const edgePath = svg.match(/<path[^>]*class="react-flow__edge-path"[^>]*>/)?.[0] ?? "";
    expect(edgePath).toMatch(/stroke:\s*(rgb|#)/);
    expect(edgePath).toMatch(/stroke-dasharray:\s*[^;"]*\d/);
    expect(edgePath).toMatch(/marker-start="url\('?#adhocdraw-crow-many/);
    expect(svg).toMatch(/<marker[^>]*id="adhocdraw-crow-many"/);
    expect(svg).toMatch(/<marker[^>]*class="react-flow__arrowhead"/);
    expect(svg).not.toContain("react-flow__handle");
    expect(svg).not.toContain("react-flow__resize-control");
    expect(svg).not.toContain("react-flow__edgeupdater");
  });
});
