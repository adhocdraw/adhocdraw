// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react";
import { api } from "../api";
import type { Diagram, DiagramVersionSummary } from "../api";
import ConfirmDialog from "./ConfirmDialog";

interface VersionHistoryPanelProps {
  diagramId: string;
  onClose: () => void;
  onRestored: (diagram: Diagram) => void;
}

export default function VersionHistoryPanel({ diagramId, onClose, onRestored }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DiagramVersionSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);

  const refresh = () => api.listVersions(diagramId).then(setVersions).catch(console.error);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramId]);

  const handleSaveVersion = async () => {
    setSaving(true);
    await api.saveVersion(diagramId, "Manual save");
    setSaving(false);
    refresh();
  };

  const confirmRestore = async () => {
    if (!restoreTargetId) return;
    const versionId = restoreTargetId;
    setRestoreTargetId(null);
    const diagram = await api.restoreVersion(diagramId, versionId);
    onRestored(diagram);
  };

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-panel version-history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2>Version history</h2>
          <button className="shortcuts-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <button className="save-version-btn" onClick={handleSaveVersion} disabled={saving}>
          {saving ? "Saving..." : "Save version"}
        </button>
        {versions.length === 0 ? (
          <p className="version-empty">No versions saved yet.</p>
        ) : (
          <ul className="version-list">
            {versions.map((v) => (
              <li key={v.id}>
                <div>
                  <div className="version-label">{v.label}</div>
                  <div className="version-date">{new Date(v.created_at).toLocaleString()}</div>
                </div>
                <button onClick={() => setRestoreTargetId(v.id)}>Restore</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* React portals (AlertDialog.Portal, inside ConfirmDialog) still
          bubble click events through the *component* tree, not the DOM
          tree they're rendered into - without this wrapper, a click on the
          dialog's own Cancel/Confirm button would bubble up to the overlay
          above and close this whole panel along with the dialog. */}
      <div onClick={(e) => e.stopPropagation()}>
        <ConfirmDialog
          open={restoreTargetId !== null}
          onOpenChange={(open) => !open && setRestoreTargetId(null)}
          title="Restore version"
          description="Restore this version? Current canvas content will be replaced."
          confirmLabel="Restore"
          onConfirm={confirmRestore}
        />
      </div>
    </div>
  );
}
