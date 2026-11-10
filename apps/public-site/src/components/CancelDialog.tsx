"use client";

import { useEffect, useRef, useState } from "react";
import type { Translate } from "@/i18n/locales";

interface CancelDialogProps {
  onConfirm: () => Promise<void>;
  onClose: () => void;
  t: Translate;
}

export function CancelDialog({ onConfirm, onClose, t }: CancelDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  // Native <dialog> + showModal(): the browser supplies the focus trap, Escape
  // and an inert background. Mounted = open; the parent unmounts it to close.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const confirm = async () => {
    setIsSaving(true);
    await onConfirm();
    setIsSaving(false);
  };

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-label={t("manage.cancelHeading")}
      onCancel={(event) => {
        event.preventDefault();
        if (!isSaving) onClose();
      }}
    >
      <div className="modal-box sm:max-w-md">
        <h2 className="text-lg font-bold">{t("manage.cancelHeading")}</h2>
        <div className="modal-action flex-wrap">
          <button type="button" className="btn btn-primary" onClick={onClose} disabled={isSaving}>
            {t("manage.cancelKeep")}
          </button>
          <button type="button" className="btn btn-outline btn-error" onClick={confirm} disabled={isSaving}>
            {isSaving && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
            {t("manage.cancelConfirm")}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" aria-hidden="true" onClick={() => !isSaving && onClose()} />
    </dialog>
  );
}
