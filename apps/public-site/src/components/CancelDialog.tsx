"use client";

import { useState } from "react";
import type { Translate } from "@/i18n/locales";
import styles from "./CancelDialog.module.css";

interface CancelDialogProps {
  onConfirm: () => Promise<void>;
  onClose: () => void;
  t: Translate;
}

export function CancelDialog({ onConfirm, onClose, t }: CancelDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const confirm = async () => {
    setIsSaving(true);
    await onConfirm();
    setIsSaving(false);
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={t("manage.cancelHeading")}>
      <div className={styles.dialog}>
        <h2 className={styles.heading}>{t("manage.cancelHeading")}</h2>
        <div className={styles.footer}>
          <button type="button" className={styles.keep} onClick={onClose} disabled={isSaving}>
            {t("manage.cancelKeep")}
          </button>
          <button type="button" className={styles.confirm} onClick={confirm} disabled={isSaving}>
            {t("manage.cancelConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
