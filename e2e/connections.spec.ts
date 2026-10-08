// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget, deselectAll, dragHandle, dragNodeTo, settleLayout, spreadNodes } from "./helpers";

// Regression coverage for the any-side connection fix. Three bugs had to be
// fixed for this to work: (1) React Flow only lets a drag START from a
// handle registered in its internal "source" bucket by default - a drag
// starting from a declared type="target" handle interacts fine but silently
// fails to render an edge, since getEdgePosition only checks the source
// bucket for the drag-start side (no loose-mode fallback there, unlike the
// drop/target side). Fix: every handle is now declared type="source" (loose
// connectionMode still lets them receive connections too). (2) Target-type
// handles were rendered before the node's content div in the DOM, so the
// content painted over them and swallowed the initiating click. (3) The Top
// and Bottom handles on a node had no explicit `id`, so both fell back to
// the same (null) handle id - React Flow's getHandle() treats a missing id
// as "just use the first registered handle", so any edge touching Bottom
// silently resolved to Top instead. Fix: give Top and Bottom explicit ids
// ("top"/"bottom"), matching Left/Right's existing "left"/"right".
test.describe("Node connections", () => {
  test("connects from a source handle to a target handle (bottom -> top)", async ({ diagramPage: page }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);

    await dragHandle(page, decision, "bottom", process, "top");
    const edge = page.locator(".react-flow__edge");
    await expect(edge).toHaveCount(1);
    // Not just "an edge exists" - it must actually be bound to the bottom
    // and top handles specifically, not silently fall back to some other
    // handle on either node.
    const decisionId = await decision.getAttribute("data-id");
    const processId = await process.getAttribute("data-id");
    await expect(edge).toHaveAttribute("data-id", new RegExp(`${decisionId}bottom-.*${processId}top`));
  });

  test("connects using the same side on both nodes (left -> left)", async ({ diagramPage: page }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);

    await dragHandle(page, decision, "left", process, "left");
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  });

  test("connects right -> bottom", async ({ diagramPage: page }) => {
    const decision = await addWidget(page, "Decision");
    const process = await addWidget(page, "Process");
    await settleLayout(page);
    await spreadNodes(page, [decision, process]);

    await dragHandle(page, decision, "right", process, "bottom");
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  });

  test("connects sticky notes and text nodes on any side", async ({ diagramPage: page }) => {
    const sticky = await addWidget(page, "Sticky Note");
    const text = await addWidget(page, "Text");
    await settleLayout(page);
    await spreadNodes(page, [sticky, text]);

    await dragHandle(page, sticky, "right", text, "left");
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  });

  test("a node's top and bottom handles are independent - edges from each land on separate targets", async ({
    diagramPage: page,
  }) => {
    const source = await addWidget(page, "Decision");
    const top = await addWidget(page, "Process");
    const bottom = await addWidget(page, "Start / End");
    await settleLayout(page);
    // Stack them vertically: top, source in the middle, bottom. (spreadNodes
    // only has two slots, so with three shapes two would overlap.)
    const canvas = await page.locator(".canvas-flow").boundingBox();
    if (!canvas) throw new Error("canvas not found");
    const cx = canvas.x + canvas.width / 2;
    const cy = canvas.y + canvas.height / 2;
    await dragNodeTo(page, top, cx, cy - 140);
    await dragNodeTo(page, bottom, cx, cy + 140);
    await dragNodeTo(page, source, cx, cy);
    await deselectAll(page);

    await dragHandle(page, source, "top", top, "bottom");
    await dragHandle(page, source, "bottom", bottom, "top");

    await expect(page.locator(".react-flow__edge")).toHaveCount(2);
    const sourceId = await source.getAttribute("data-id");
    const topId = await top.getAttribute("data-id");
    const bottomId = await bottom.getAttribute("data-id");
    const edgeIds = await page.locator(".react-flow__edge").evaluateAll((els) => els.map((el) => el.getAttribute("data-id")));
    expect(edgeIds.some((id) => id?.includes(`${sourceId}top-`) && id.includes(`${topId}bottom`))).toBe(true);
    expect(edgeIds.some((id) => id?.includes(`${sourceId}bottom-`) && id.includes(`${bottomId}top`))).toBe(true);
  });
});
