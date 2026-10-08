// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import * as Toast from "@radix-ui/react-toast";
import { v4 as uuid } from "uuid";

interface ToastMessage {
  id: string;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Replaces the native, unstyled window.alert() used for error messages
// (invalid file imports) - scattered across DiagramsPanel and Canvas, both
// of which now call this instead. A dismissible, non-blocking toast rather
// than a modal that halts everything until clicked away.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string) => {
    setToasts((prev) => [...prev, { id: uuid(), message }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            className="app-toast"
            duration={5000}
            onOpenChange={(open) => !open && dismiss(t.id)}
          >
            <Toast.Description>{t.message}</Toast.Description>
            <Toast.Close className="app-toast-close" aria-label="Dismiss">
              ×
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="app-toast-viewport" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
