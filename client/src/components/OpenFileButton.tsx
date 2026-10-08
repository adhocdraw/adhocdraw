// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { fileOpen } from "browser-fs-access";
import type { FileWithHandle } from "browser-fs-access";
import type { DiagramData } from "../api";
import { useToast } from "../contexts/ToastContext";
import Icon from "./Icon";

interface OpenFileButtonProps {
  onImport: (name: string, data: DiagramData, handle: FileWithHandle["handle"]) => void;
}

function isDiagramData(value: unknown): value is DiagramData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.pages) || (Array.isArray(v.nodes) && Array.isArray(v.edges));
}

// Toolbar button: opens a diagram previously written by "Save to file" as a
// new diagram.
export default function OpenFileButton({ onImport }: OpenFileButtonProps) {
  const { showToast } = useToast();

  const openFromFile = async () => {
    let file: FileWithHandle;
    try {
      file = await fileOpen({ description: "Diagram JSON", extensions: [".json"], mimeTypes: ["application/json"] });
    } catch {
      // User cancelled the picker - nothing to do.
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed.data ?? parsed;
      if (!isDiagramData(data)) throw new Error("missing pages/nodes/edges");
      const fileName =
        typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : file.name.replace(/\.json$/i, "");
      onImport(fileName, data, file.handle);
    } catch {
      showToast("That file doesn't look like a valid diagram export (expected JSON from this app's \"Save to file\").");
    }
  };

  return (
    <button
      type="button"
      onClick={openFromFile}
      title="Open a diagram from a file on your computer"
      aria-label="Open from file"
    >
      <Icon name="folder" />
      <span className="btn-label">Open from file</span>
    </button>
  );
}
