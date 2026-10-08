// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

type AlignKind = "left" | "centerH" | "right" | "top" | "centerV" | "bottom";

interface AlignPanelProps {
  selectionCount: number;
  onAlign: (kind: AlignKind) => void;
  onDistribute: (axis: "horizontal" | "vertical") => void;
}

export default function AlignPanel({ selectionCount, onAlign, onDistribute }: AlignPanelProps) {
  const canDistribute = selectionCount >= 3;
  return (
    <div className="align-panel">
      <button onClick={() => onAlign("left")} title="Align left">
        ⊢
      </button>
      <button onClick={() => onAlign("centerH")} title="Align center (horizontal)">
        ⊣⊢
      </button>
      <button onClick={() => onAlign("right")} title="Align right">
        ⊣
      </button>
      <button onClick={() => onAlign("top")} title="Align top">
        ⊤
      </button>
      <button onClick={() => onAlign("centerV")} title="Align middle (vertical)">
        ⊥⊤
      </button>
      <button onClick={() => onAlign("bottom")} title="Align bottom">
        ⊥
      </button>
      <span className="align-panel-divider" />
      <button onClick={() => onDistribute("horizontal")} disabled={!canDistribute} title="Distribute horizontally">
        ⇔
      </button>
      <button onClick={() => onDistribute("vertical")} disabled={!canDistribute} title="Distribute vertically">
        ⇕
      </button>
    </div>
  );
}
