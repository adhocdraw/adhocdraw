// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import * as fuzzy from "fuzzy";

// Ranks and filters `items` against a free-text query. An exact label match
// ranks highest, then a prefix match, then a fuzzy match - checked per
// query word against the whole label (rather than the whole query against
// the whole label) so word order in the query doesn't matter: "end start"
// still finds "Start / End". Each word still only needs to appear as a
// (possibly non-contiguous) subsequence of the label - fuzzy.match's own
// scoring - so a missed keystroke like "prcess" still finds "Process".
// Returns items unchanged, in their original order, when the query is
// empty.
export function fuzzyRank<T>(items: T[], getLabel: (item: T) => string, query: string): T[] {
  const trimmed = query.trim();
  if (!trimmed) return items;

  const q = trimmed.toLowerCase();
  const queryWords = q.split(/\s+/).filter(Boolean);

  const ranked: { item: T; score: number }[] = [];
  for (const item of items) {
    const label = getLabel(item).toLowerCase();
    let score: number;
    if (label === q) {
      score = 3_000_000;
    } else if (label.startsWith(q)) {
      score = 2_000_000 - label.length;
    } else {
      let total = 0;
      let allMatched = true;
      for (const word of queryWords) {
        const result = fuzzy.match(word, label);
        if (!result) {
          allMatched = false;
          break;
        }
        total += result.score;
      }
      if (!allMatched) continue;
      score = total;
    }
    ranked.push({ item, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.map((r) => r.item);
}
