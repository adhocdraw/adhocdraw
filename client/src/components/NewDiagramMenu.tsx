// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { TEMPLATES } from "../templates";
import Flyout from "./Flyout";
import Icon from "./Icon";

// Menu order: the chart option goes last (TEMPLATES keeps "blank" first because it is
// the default template elsewhere).
const MENU_ORDER = [...TEMPLATES].sort((a, b) => Number(a.key === "blank") - Number(b.key === "blank"));

interface NewDiagramMenuProps {
  onCreate: (baseName: string, templateKey: string) => void;
}

export default function NewDiagramMenu({ onCreate }: NewDiagramMenuProps) {
  const create = (templateKey: string, close: () => void) => {
    const template = TEMPLATES.find((t) => t.key === templateKey) ?? TEMPLATES[0];
    onCreate(template.defaultName, templateKey);
    close();
  };

  return (
    <Flyout
      label={<><Icon name="newDiagram" /><span className="btn-label">New</span><span className="caret"> ▾</span></>}
      ariaLabel="New"
      panelClassName="new-diagram-flyout"
      title="Create a new diagram: blank chart, white board or a starter template"
    >
      {(close) => (
        <>
          {MENU_ORDER.map((t) => (
            <button key={t.key} type="button" className="flyout-item" onClick={() => create(t.key, close)}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
        </>
      )}
    </Flyout>
  );
}
