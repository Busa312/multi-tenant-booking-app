import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { formatDateTimeLabel } from "../lib/tenantTime.js";
import { NoShowBadge } from "./NoShowBadge.js";
import { BlockedBadge } from "./BlockedBadge.js";

interface NoShowRiskRowProps {
  appointment: AppointmentSummary;
  timezone: string;
}

/** R360: one upcoming booking worth a call — when, who, and the number to ring. */
export function NoShowRiskRow({ appointment, timezone }: NoShowRiskRowProps) {
  const { lang } = useI18n();
  const nameOf = useLocalizedName();

  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="min-w-0 truncate text-[13.5px] font-semibold">{appointment.userName}</span>
        <span className="text-[13px] whitespace-nowrap tabular-nums">
          {formatDateTimeLabel(appointment.startAt, timezone, lang)}
        </span>
      </div>
      <div className="truncate text-xs text-base-content/60">
        {serviceLabel(appointment, nameOf)}
        {appointment.professionalName && ` · ${nameOf(appointment.professionalName, appointment.professionalNameI18n)}`}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap gap-1">
          <NoShowBadge history={appointment.noShowHistory} />
          <BlockedBadge blocked={appointment.phoneBlocked} />
        </span>
        {/* The point of the list: staff call to confirm. */}
        <a className="link text-[13px] font-semibold tabular-nums" href={`tel:${appointment.phoneNumber.replace(/\s/g, "")}`}>
          {appointment.phoneNumber}
        </a>
      </div>
    </li>
  );
}
