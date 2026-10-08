// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import type { Node } from "@xyflow/react";
import { motion } from "framer-motion";

export interface CustomField {
  key: string;
  value: string;
}

export interface FormatRule {
  field: string;
  operator: "equals" | "contains";
  value: string;
  color: string;
}

interface DataPanelProps {
  node: Node | null;
  onChange: (patch: { customFields?: CustomField[]; formatRule?: FormatRule | null }) => void;
  onClose: () => void;
  floatingRef: (el: HTMLElement | null) => void;
  floatingStyle: React.CSSProperties;
}

export default function DataPanel({ node, onChange, onClose, floatingRef, floatingStyle }: DataPanelProps) {
  if (!node) return null;
  const fields = ((node.data as { customFields?: CustomField[] }).customFields ?? []) as CustomField[];
  const rule = (node.data as { formatRule?: FormatRule }).formatRule;

  const updateField = (index: number, patch: Partial<CustomField>) => {
    onChange({ customFields: fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
  };

  const addField = () => onChange({ customFields: [...fields, { key: "", value: "" }] });
  const removeField = (index: number) => onChange({ customFields: fields.filter((_, i) => i !== index) });

  return (
    <div ref={floatingRef} style={floatingStyle}>
      <motion.div
        className="data-panel"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
      >
      <div className="data-panel-header">
        <h3>Data</h3>
        <button className="data-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="data-panel-fields">
        {fields.map((f, i) => (
          <div key={i} className="data-panel-field-row">
            <input
              type="text"
              placeholder="key"
              value={f.key}
              onChange={(e) => updateField(i, { key: e.target.value })}
            />
            <input
              type="text"
              placeholder="value"
              value={f.value}
              onChange={(e) => updateField(i, { value: e.target.value })}
            />
            <button onClick={() => removeField(i)} title="Remove field" aria-label="Remove field">
              ×
            </button>
          </div>
        ))}
        <button className="data-panel-add-field" onClick={addField}>
          + Field
        </button>
      </div>
      <div className="data-panel-rule">
        <h4>Conditional formatting</h4>
        <div className="data-panel-rule-row">
          <input
            type="text"
            placeholder="field"
            value={rule?.field ?? ""}
            onChange={(e) => onChange({ formatRule: { ...(rule ?? defaultRule()), field: e.target.value } })}
          />
          <select
            value={rule?.operator ?? "equals"}
            onChange={(e) =>
              onChange({ formatRule: { ...(rule ?? defaultRule()), operator: e.target.value as FormatRule["operator"] } })
            }
          >
            <option value="equals">equals</option>
            <option value="contains">contains</option>
          </select>
          <input
            type="text"
            placeholder="value"
            value={rule?.value ?? ""}
            onChange={(e) => onChange({ formatRule: { ...(rule ?? defaultRule()), value: e.target.value } })}
          />
          <input
            type="color"
            value={rule?.color ?? "#ffcccb"}
            onChange={(e) => onChange({ formatRule: { ...(rule ?? defaultRule()), color: e.target.value } })}
          />
        </div>
        {rule && (
          <button className="data-panel-clear-rule" onClick={() => onChange({ formatRule: null })}>
            Clear rule
          </button>
        )}
      </div>
      </motion.div>
    </div>
  );
}

function defaultRule(): FormatRule {
  return { field: "", operator: "equals", value: "", color: "#ffcccb" };
}
