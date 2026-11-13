import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { NeedsMarkingRow } from "./NeedsMarkingRow.js";
import { Alert, ButtonLink, Card, Eyebrow } from "./ui/index.js";

interface NeedsMarkingCardProps {
  /** The oldest few past appointments still `booked`. */
  appointments: AppointmentSummary[];
  /** All of them, including the ones not listed. */
  count: number;
  timezone: string;
  /** The appointment being saved right now, if any. */
  savingId: string | null;
  error: string | null;
  onMark: (appointment: AppointmentSummary, status: "completed" | "no_show") => void;
}

/**
 * R370: past bookings still marked *booked*. Nothing changes status by itself
 * (R100), so until someone says whether the client came, the no-show rate and
 * the completed value on this page are guesses. Rendered only when there is
 * something to mark.
 */
export function NeedsMarkingCard({ appointments, count, timezone, savingId, error, onMark }: NeedsMarkingCardProps) {
  const { t } = useI18n();

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0">
          <Eyebrow>{t("dashboard.markTitle")}</Eyebrow>
          <div className="mt-0.5 font-display text-2xl leading-tight font-bold">{t("dashboard.markCount", { count })}</div>
          <p className="mt-1 text-sm text-base-content/60">{t("dashboard.markHint")}</p>
        </div>
        <ButtonLink to="/bookings" variant="secondary" size="sm" className="ml-auto flex-none">
          {t("dashboard.markOpenAll")}
        </ButtonLink>
      </div>

      {error && (
        <Alert flush className="mt-3">
          {error}
        </Alert>
      )}

      <ul className="mt-2 divide-y divide-base-300">
        {appointments.map((appointment) => (
          <NeedsMarkingRow
            key={appointment.id}
            appointment={appointment}
            timezone={timezone}
            saving={savingId === appointment.id}
            disabled={savingId !== null}
            onMark={onMark}
          />
        ))}
      </ul>

      {count > appointments.length && (
        <p className="mt-2 text-xs text-base-content/55">
          {t("dashboard.markMore", { shown: appointments.length, count })}
        </p>
      )}
    </Card>
  );
}
