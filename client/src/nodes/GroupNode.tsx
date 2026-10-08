// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export default function GroupNode({ selected }: NodeProps) {
  return (
    <div className="group-node">
      <NodeResizer isVisible={selected} minWidth={40} minHeight={40} lineStyle={{ borderColor: "#5b6ee1" }} />
    </div>
  );
}
