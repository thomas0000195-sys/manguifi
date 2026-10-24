"use client";

import { useEffect, useRef } from "react";

/** Boîte de confirmation accessible. L'action principale est « rester » : elle est sûre par défaut. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-4 sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl">
        <h2 id="confirm-title" className="text-lg font-bold text-navy-950">{title}</h2>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium text-navy-950 hover:bg-navy-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
