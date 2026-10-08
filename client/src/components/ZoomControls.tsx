// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { Controls, ControlButton, useReactFlow, useViewport } from "@xyflow/react";
import { FIT_VIEW_OPTIONS, MAX_ZOOM, MIN_ZOOM, stepZoom } from "./zoomOptions";
import Icon from "./Icon";

// React Flow's zoom / fit / lock controls as a horizontal row, with the zoom
// percentage between + and - (click it to go back to 100%). The order is set by
// CSS `order` in App.css. Rendered into the canvas footer (right end) by Canvas.
export default function ZoomControls() {
  const { zoom } = useViewport();
  const { zoomTo, getZoom } = useReactFlow();
  const step = (direction: 1 | -1) => zoomTo(stepZoom(getZoom(), direction), { duration: 150 });
  const percent = Math.round(zoom * 100);
  return (
    <Controls orientation="horizontal" showZoom={false} fitViewOptions={FIT_VIEW_OPTIONS}>
      <ControlButton
        className="react-flow__controls-zoomin"
        onClick={() => step(1)}
        disabled={zoom >= MAX_ZOOM - 0.001}
        title="Zoom in"
        aria-label="Zoom In"
      >
        <Icon name="plus" />
      </ControlButton>
      <ControlButton
        className="controls-zoom-value"
        onClick={() => zoomTo(1, { duration: 200 })}
        title="Zoom level (click for 100%)"
        aria-label={`Zoom ${percent}%`}
      >
        {percent}%
      </ControlButton>
      <ControlButton
        className="react-flow__controls-zoomout"
        onClick={() => step(-1)}
        disabled={zoom <= MIN_ZOOM + 0.001}
        title="Zoom out"
        aria-label="Zoom Out"
      >
        <Icon name="minus" />
      </ControlButton>
    </Controls>
  );
}
