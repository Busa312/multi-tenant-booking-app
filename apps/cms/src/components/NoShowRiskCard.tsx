import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { NoShowRiskRow } from "./NoShowRiskRow.js";
import { Card, Eyebrow } from "./ui/index.js";

interface NoShowRiskCardProps {
  /** The soonest few of them. */
  appointments: AppointmentSummary[];
  /** All of them, including the ones not listed. */
  count: number;
  timezone: string;
}

/**
 * R360: the coming week's bookings from customers who missed one of their
 * last visits — seen while there's still time to call and confirm. Rendered
 * only when there is one.
 */
export function NoShowRiskCard({ appointments, count, timezone }: NoShowRiskCardProps) {
  const { t } = useI18n();

  return (
    <Card>
      <Eyebrow>{t("dashboard.riskTitle")}</Eyebrow>
      <div className="mt-0.5 font-display text-2xl leading-tight font-bold">{t("dashboard.riskCount", { count })}</div>
      <p className="mt-1 text-sm text-base-content/60">{t("dashboard.riskHint")}</p>

      <ul className="mt-2 divide-y divide-base-300">
        {appointments.map((appointment) => (
          <NoShowRiskRow key={appointment.id} appointment={appointment} timezone={timezone} />
        ))}
      </ul>

      {count > appointments.length && (
        <p className="mt-2 text-xs text-base-content/55">{t("dashboard.riskMore", { shown: appointments.length, count })}</p>
      )}
    </Card>
  );
}
