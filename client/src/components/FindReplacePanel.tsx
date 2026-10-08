// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

interface FindReplacePanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  replacement: string;
  onReplacementChange: (value: string) => void;
  matchCount: number;
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export default function FindReplacePanel({
  query,
  onQueryChange,
  replacement,
  onReplacementChange,
  matchCount,
  currentIndex,
  onNext,
  onPrev,
  onReplace,
  onReplaceAll,
  onClose,
}: FindReplacePanelProps) {
  return (
    <div className="find-replace-panel">
      <div className="find-replace-row">
        <input
          autoFocus
          type="text"
          placeholder="Find"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.shiftKey ? onPrev : onNext)();
            if (e.key === "Escape") onClose();
          }}
        />
        <span className="find-replace-count">{matchCount > 0 ? `${currentIndex + 1}/${matchCount}` : "0/0"}</span>
        <button onClick={onPrev} disabled={matchCount === 0} title="Previous match">
          ↑
        </button>
        <button onClick={onNext} disabled={matchCount === 0} title="Next match">
          ↓
        </button>
        <button className="find-replace-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="find-replace-row">
        <input
          type="text"
          placeholder="Replace with"
          value={replacement}
          onChange={(e) => onReplacementChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onReplace()}
        />
        <button onClick={onReplace} disabled={matchCount === 0}>
          Replace
        </button>
        <button onClick={onReplaceAll} disabled={matchCount === 0}>
          Replace All
        </button>
      </div>
    </div>
  );
}
