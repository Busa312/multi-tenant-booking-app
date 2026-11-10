import type { BookingConflict } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { formatDateTimeLabel } from "../lib/tenantTime.js";
import { Alert } from "./ui/index.js";

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
  const nameOf = useLocalizedName();

  const professional = (conflict: BookingConflict) =>
    conflict.professionalName
      ? nameOf(conflict.professionalName, conflict.professionalNameI18n)
      : t("bookings.conflictNoProfessional");

  function describe(conflict: BookingConflict): string {
    const at = conflict.startAt ? formatDateTimeLabel(conflict.startAt, timezone, lang) : "";
    switch (conflict.type) {
      case "appointment":
        return t("bookings.conflictAppointment", {
          name: professional(conflict),
          at,
          customer: conflict.detail ?? "",
        });
      case "time_off":
        return conflict.detail
          ? t("bookings.conflictTimeOffReason", { at, reason: conflict.detail })
          : t("bookings.conflictTimeOff", { at });
      case "outside_business_hours":
        return t("bookings.conflictOutsideHours");
      // R250: a customer on the public site picked this time and is finishing
      case "hold":
        return t("bookings.conflictHold", {
          name: professional(conflict),
          at,
        });
    }
  }

  return (
    // Spans rather than a <ul>: Alert renders a <p>, and a list inside a
    // paragraph is invalid markup — the CSS module does the stacking.
    <Alert variant="warning">
      <span className="block font-semibold">{t("bookings.conflictLead")}</span>
      {conflicts.map((conflict, index) => (
        // Nothing in a conflict is unique (two blocks can share a window), and
        // the list is replaced wholesale on every attempt, so the index is a
        // stable enough key here.
        <span key={`${conflict.type}-${index}`} className="mt-1 block before:content-['•_']">
          {describe(conflict)}
        </span>
      ))}
    </Alert>
  );
}
