// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "./fixtures";
import { addWidget } from "./helpers";

// Regression coverage for a bug report: edges appeared to end in empty
// space near several custom-SVG shapes (Cloud, Database, Document, Server,
// Actor) instead of touching them. The shapes' SVG used a generic
// `viewBox="0 0 200 120"` canvas that didn't match their own drawn ink
// extents, so with `preserveAspectRatio="none"` stretching that viewBox to
// fill the node, the drawn silhouette fell short of the node's edges -
// exactly where the connection handles sit. The fix crops each shape's
// viewBox to its own ink bounding box so the silhouette reaches all four
// edges. This asserts the crop stuck, without needing pixel sampling.
const EXPECTED_VIEWBOX: Record<string, string> = {
  Database: "10 4 180 112",
  Cloud: "15 8 170 82",
  Document: "10 10 180 98",
  "Actor / User": "18 6 64 109",
  Server: "10 8 180 104",
};

test.describe("Custom SVG shapes fill their node bounds", () => {
  for (const [label, viewBox] of Object.entries(EXPECTED_VIEWBOX)) {
    test(`${label}'s viewBox is cropped to its own ink extents, not a generic canvas`, async ({
      diagramPage: page,
    }) => {
      const node = await addWidget(page, label);
      await expect(node.locator("svg.shape-svg")).toHaveAttribute("viewBox", viewBox);
      await expect(node.locator("svg.shape-svg")).toHaveAttribute("preserveAspectRatio", "none");
    });
  }
});
