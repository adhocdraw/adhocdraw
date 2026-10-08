// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, dragHandle, dragNodeTo, openDiagram, settleLayout, spreadNodes, deselectAll } from "./helpers";

test.describe("Connector style", () => {
  test("defaults to elbow and offers straight/curved alternatives", async ({ diagramPage: page }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);
    await dragHandle(page, decision, "right", process, "left");

    await page.locator(".react-flow__edge").click();
    const connectorSelect = page.locator(".edge-style-panel label", { hasText: "Connector" }).locator("select");
    await expect(connectorSelect).toHaveValue("elbow");
  });

  test("switching to straight renders a direct path with no right-angle bend", async ({ diagramPage: page }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);
    await dragHandle(page, decision, "right", process, "left");

    await page.locator(".react-flow__edge").click();
    const connectorSelect = page.locator(".edge-style-panel label", { hasText: "Connector" }).locator("select");
    await connectorSelect.selectOption("straight");

    const d = await page.locator(".react-flow__edge-path").first().getAttribute("d");
    // A smoothstep (elbow) path has multiple line segments; a straight path
    // is a single "M x,y L x,y" with no intermediate points.
    expect(d?.match(/[ML]/g)?.length).toBe(2);
  });

  test("switching to curved renders a bezier path", async ({ diagramPage: page }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);
    await dragHandle(page, decision, "right", process, "left");

    await page.locator(".react-flow__edge").click();
    const connectorSelect = page.locator(".edge-style-panel label", { hasText: "Connector" }).locator("select");
    await connectorSelect.selectOption("curved");

    const d = await page.locator(".react-flow__edge-path").first().getAttribute("d");
    expect(d).toContain("C");
  });

  test("smart routes around a node sitting directly between source and target", async ({ diagramPage: page }) => {
    const a = await addWidget(page, "Process");
    const obstacle = await addWidget(page, "Decision");
    const c = await addWidget(page, "Process");
    await settleLayout(page);
    // Line the three up in a row on the same y - a straight or elbow edge
    // from a to c would run directly through the obstacle sitting between
    // them.
    const canvasBox = await page.locator(".canvas-flow").boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    const y = canvasBox.y + canvasBox.height / 2;
    await dragNodeTo(page, a, canvasBox.x + canvasBox.width * 0.2, y);
    await dragNodeTo(page, obstacle, canvasBox.x + canvasBox.width * 0.5, y);
    await dragNodeTo(page, c, canvasBox.x + canvasBox.width * 0.8, y);
    await deselectAll(page);
    await dragHandle(page, a, "right", c, "left");

    // The edge's center runs straight through the obstacle, which would take
    // the click - grab it just after the source node instead.
    const point = await page.evaluate(() => {
      const path = document.querySelector(".react-flow__edge-path") as SVGPathElement;
      const pt = path.getPointAtLength(path.getTotalLength() * 0.12);
      const ctm = path.getScreenCTM()!;
      return { x: pt.x * ctm.a + pt.y * ctm.c + ctm.e, y: pt.x * ctm.b + pt.y * ctm.d + ctm.f };
    });
    await page.mouse.click(point.x, point.y);
    const connectorSelect = page.locator(".edge-style-panel label", { hasText: "Connector" }).locator("select");
    await connectorSelect.selectOption("smart");

    // Smart routing plugs its computed route into the same waypoint
    // mechanism manual waypoints use (see edge-waypoints.spec.ts) - a
    // non-empty route around the obstacle shows up as waypoint markers.
    await expect(page.locator(".edge-waypoint")).not.toHaveCount(0);
  });

  test("connector style persists through reload", async ({ diagramPage: page, diagram }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);
    await dragHandle(page, decision, "right", process, "left");

    await page.locator(".react-flow__edge").click();
    const connectorSelect = page.locator(".edge-style-panel label", { hasText: "Connector" }).locator("select");
    await connectorSelect.selectOption("straight");
    await expect(page.locator(".save-status")).toHaveText(/^Saved/, { timeout: 5000 });

    await openDiagram(page, diagram.name);
    await page.locator(".react-flow__edge").click({ force: true });
    await expect(page.locator(".edge-style-panel label", { hasText: "Connector" }).locator("select")).toHaveValue(
      "straight"
    );
  });
});

test("connectors and arrowheads are black on a light canvas and white on a dark one", async ({ diagramPage: page }) => {
  const { addWidget, dragHandle, settleLayout, spreadNodes } = await import("./helpers");
  const a = await addWidget(page, "Process");
  const b = await addWidget(page, "Process");
  await settleLayout(page);
  await spreadNodes(page, [a, b]);
  await dragHandle(page, a, "right", b, "left");
  const path = page.locator(".react-flow__edge-path").first();
  const head = page.locator(".react-flow__arrowhead polyline, .react-flow__arrowhead path").first();
  const colours = async () => ({
    line: await path.evaluate((el) => getComputedStyle(el).stroke),
    head: await head.evaluate((el) => getComputedStyle(el).stroke),
  });
  await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } }); // deselect the new edge
  expect(await colours()).toEqual({ line: "rgb(0, 0, 0)", head: "rgb(0, 0, 0)" });
  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect.poll(async () => (await colours()).line).toBe("rgb(255, 255, 255)");
  expect((await colours()).head).toBe("rgb(255, 255, 255)");
});
