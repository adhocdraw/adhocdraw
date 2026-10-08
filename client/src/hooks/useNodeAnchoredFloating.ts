// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect } from "react";
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";
import type { Placement } from "@floating-ui/react";

// Anchors a popover to a React Flow node's actual DOM element (found via its
// data-id) instead of hand-computing `node.position * zoom + viewport.x/y`
// on every render. That manual math was a real source of bugs (e.g. a
// popover's own action button shifting position mid-click as content
// changed) and never handled the popover running off the edge of the
// canvas. `animationFrame: true` keeps the popover glued to the node while
// it's being dragged, panned, or zoomed, since node movement is a CSS
// transform autoUpdate can't otherwise observe.
export function useNodeAnchoredFloating(nodeId: string | null, placement: Placement = "right-start") {
  const { refs, floatingStyles, update } = useFloating({
    placement,
    strategy: "fixed",
    open: nodeId !== null,
    whileElementsMounted: (referenceEl, floatingEl, cb) =>
      autoUpdate(referenceEl, floatingEl, cb, { animationFrame: true }),
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  });

  useLayoutEffect(() => {
    if (!nodeId) {
      refs.setReference(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`);
    refs.setReference(el);
    update();
    // refs/update are stable identities from useFloating; only re-run when
    // the target node actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  return { setFloating: refs.setFloating, floatingStyles };
}
