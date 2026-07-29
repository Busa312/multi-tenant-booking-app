import type { BookingConflict } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { formatDateTimeLabel } from "../lib/tenantTime.js";
import { Alert } from "./ui/index.js";
import styles from "./BookingConflictNotice.module.css";

interface BookingConflictNoticeProps {
  conflicts: BookingConflict[];
  /** Tenant timezone — conflict windows are instants and belong on the salon's clock. */
  timezone: string;
}

/**
 * R60: staff may book over a taken slot, closed hours, or someone's time off —
 * but only after seeing which of those it is. The API answers 409 with these
 * conflicts; this names each one so "book anyway" is an informed choice rather
 * than a shrug past a generic error.
 */
export function BookingConflictNotice({ conflicts, timezone }: BookingConflictNoticeProps) {
  const { t, lang } = useI18n();

  function describe(conflict: BookingConflict): string {
    const at = conflict.startAt ? formatDateTimeLabel(conflict.startAt, timezone, lang) : "";
    switch (conflict.type) {
      case "appointment":
        return t("bookings.conflictAppointment", {
          name: conflict.professionalName ?? t("bookings.conflictNoProfessional"),
          at,
          customer: conflict.detail ?? "",
        });
      case "time_off":
        return conflict.detail
          ? t("bookings.conflictTimeOffReason", { at, reason: conflict.detail })
          : t("bookings.conflictTimeOff", { at });
      case "outside_business_hours":
        return t("bookings.conflictOutsideHours");
    }
  }

  return (
    // Spans rather than a <ul>: Alert renders a <p>, and a list inside a
    // paragraph is invalid markup — the CSS module does the stacking.
    <Alert variant="warning" className={styles.notice}>
      <span className={styles.lead}>{t("bookings.conflictLead")}</span>
      {conflicts.map((conflict, index) => (
        // Nothing in a conflict is unique (two blocks can share a window), and
        // the list is replaced wholesale on every attempt, so the index is a
        // stable enough key here.
        <span key={`${conflict.type}-${index}`} className={styles.item}>
          {describe(conflict)}
        </span>
      ))}
    </Alert>
  );
}
