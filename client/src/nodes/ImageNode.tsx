// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { Handle, Position, NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { absoluteUrl } from "../api";

export default function ImageNode({ data, selected }: NodeProps) {
  const url = (data as { url?: string }).url ?? "";
  const locked = (data as { locked?: boolean }).locked ?? false;

  return (
    <div className="image-node-wrapper">
      <NodeResizer isVisible={selected && !locked} minWidth={60} minHeight={40} keepAspectRatio />
      {locked && <span className="node-lock-badge">🔒</span>}
      <img className="image-node-img" src={absoluteUrl(url)} alt="" draggable={false} />
      <Handle type="source" position={Position.Top} id="top" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Left} id="left" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Right} id="right" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectableStart isConnectableEnd />
    </div>
  );
}
