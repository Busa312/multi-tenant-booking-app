"use client";

import { useMemo, useState } from "react";
import type { Appointment } from "@booking/shared-types";
import { translator, type Locale, type Messages } from "@/i18n/locales";
import { cancelBooking, rescheduleBooking } from "@/lib/actions";
import { formatInstant } from "@/lib/tenant-time";
import { RescheduleDialog } from "./RescheduleDialog";
import { CancelDialog } from "./CancelDialog";
import styles from "./ManageAppointment.module.css";

interface ManageAppointmentProps {
  appointment: Appointment;
  token: string;
  timezone: string;
  locale: Locale;
  messages: Messages;
}

export function ManageAppointment({ appointment, token, timezone, locale, messages }: ManageAppointmentProps) {
  const t = useMemo(() => translator(messages), [messages]);
  const [current, setCurrent] = useState(appointment);
  // R110: rescheduling rotates the token, so the one in the URL dies the moment
  // the first move succeeds. Every later action uses the replacement, and the
  // address bar is rewritten so a refresh (or a bookmark) still works.
  const [activeToken, setActiveToken] = useState(token);
  const [dialog, setDialog] = useState<"reschedule" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCancelled = current.status === "cancelled";

  const isActionable = current.status === "booked" && new Date(current.startAt) > new Date();

  const reschedule = async (date: string, time: string) => {
    const result = await rescheduleBooking(activeToken, date, time);
    if (!result.ok) {
      setError(result.reason === "conflict" ? t("booking.details.slotTaken") : t("common.somethingWrong"));
      return false;
    }
    setCurrent(result.appointment);
    const rotated = result.manageUrl.split("/manage/")[1];
    if (rotated) {
      setActiveToken(rotated);
      window.history.replaceState(null, "", `/manage/${rotated}`);
    }
    setDialog(null);
    setError(null);
    return true;
  };

  const cancel = async () => {
    const result = await cancelBooking(activeToken);
    if (!result.ok) {
      setError(t("common.somethingWrong"));
      return;
    }
    setCurrent(result.appointment);
    setDialog(null);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("manage.heading")}</h1>

      <p className={styles.status} data-cancelled={isCancelled || undefined}>
        {t(`manage.status.${current.status}`)}
      </p>

      <dl className={styles.details}>
        <div className={styles.row}>
          <dt className={styles.term}>{t("booking.summary.when")}</dt>
          <dd className={styles.value}>{formatInstant(current.startAt, timezone, locale)}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t("booking.summary.services")}</dt>
          <dd className={styles.value}>{current.services.map((line) => line.name).join(", ")}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t("booking.summary.total")}</dt>
          <dd className={styles.value}>{current.price} ₾</dd>
        </div>
      </dl>

      {isCancelled && <p className={styles.cancelled}>{t("manage.cancelled")}</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {isActionable && (
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => setDialog("reschedule")}>
            {t("manage.reschedule")}
          </button>
          <button type="button" className={styles.danger} onClick={() => setDialog("cancel")}>
            {t("manage.cancel")}
          </button>
        </div>
      )}

      {dialog === "reschedule" && (
        <RescheduleDialog
          appointment={current}
          token={activeToken}
          timezone={timezone}
          locale={locale}
          onConfirm={reschedule}
          onClose={() => setDialog(null)}
          t={t}
        />
      )}

      {dialog === "cancel" && <CancelDialog onConfirm={cancel} onClose={() => setDialog(null)} t={t} />}
    </div>
  );
}
