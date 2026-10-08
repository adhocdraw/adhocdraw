// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import * as AlertDialog from "@radix-ui/react-alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

// Replaces the native, unstyled window.confirm() used for destructive
// actions (delete a diagram, restore a version) - can't be styled to match
// the rest of the app, and blocks the same way every native dialog does.
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="confirm-dialog-overlay" />
        <AlertDialog.Content className="confirm-dialog">
          <AlertDialog.Title className="confirm-dialog-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="confirm-dialog-description">{description}</AlertDialog.Description>
          <div className="confirm-dialog-actions">
            <AlertDialog.Cancel asChild>
              <button className="confirm-dialog-cancel">Cancel</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button className="confirm-dialog-confirm" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
