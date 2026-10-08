// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import type { CustomField, FormatRule } from "../components/DataPanel";

// Returns the rule's color when its target field/value condition matches
// one of the node's custom fields, else undefined (caller falls back to the
// node's own manually-set fill).
export function resolveFormatColor(data: object): string | undefined {
  const rule = (data as { formatRule?: FormatRule }).formatRule;
  if (!rule || !rule.field) return undefined;
  const fields = (data as { customFields?: CustomField[] }).customFields ?? [];
  const field = fields.find((f) => f.key === rule.field);
  if (!field) return undefined;
  const matches = rule.operator === "contains" ? field.value.includes(rule.value) : field.value === rule.value;
  return matches ? rule.color : undefined;
}
