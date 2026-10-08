// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import { Handle, Position, NodeResizer, useReactFlow } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

type Section = "className" | "attributes" | "methods";

export default function UMLClassNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState<Section | null>(null);
  const className = (data as { className?: string }).className ?? "ClassName";
  const attributes = (data as { attributes?: string }).attributes ?? "+ attribute: Type";
  const methods = (data as { methods?: string }).methods ?? "+ method(): ReturnType";
  const locked = (data as { locked?: boolean }).locked ?? false;

  const updateField = (field: Section, value: string) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n)));
  };

  const section = (field: Section, value: string, className_: string) =>
    editing === field ? (
      <textarea
        autoFocus
        className="uml-node-textarea"
        defaultValue={value}
        onBlur={(e) => {
          updateField(field, e.target.value);
          setEditing(null);
        }}
      />
    ) : (
      <div className={className_} onDoubleClick={() => !locked && setEditing(field)}>
        {value}
      </div>
    );

  return (
    <div className="uml-node-wrapper">
      <NodeResizer isVisible={selected && !locked} minWidth={140} minHeight={100} />
      {locked && <span className="node-lock-badge">🔒</span>}
      <div className="uml-node">
        {section("className", className, "uml-node-title")}
        {section("attributes", attributes, "uml-node-attributes")}
        {section("methods", methods, "uml-node-methods")}
      </div>
      <Handle type="source" position={Position.Top} id="top" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Left} id="left" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Right} id="right" isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectableStart isConnectableEnd />
    </div>
  );
}
