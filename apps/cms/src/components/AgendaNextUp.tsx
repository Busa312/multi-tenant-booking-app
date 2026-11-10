import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { formatTimeLabel } from "../lib/tenantTime.js";
import { BookingStatusPill } from "./BookingStatusPill.js";
import { Icon } from "./ui/index.js";

interface AgendaNextUpProps {
  appointment: AppointmentSummary;
  timezone: string;
}

/**
 * The one appointment the desk is about to deal with, pulled out of the list and
 * given the room to be read across a counter. Its own file because it shares no
 * style vocabulary with the compact rows underneath it.
 */
export function AgendaNextUp({ appointment, timezone }: AgendaNextUpProps) {
  const { t, lang } = useI18n();
  const nameOf = useLocalizedName();

  return (
    <div className="mb-4 rounded-box border border-primary/20 bg-primary/8 px-4 py-4 sm:px-5">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="text-[11px] font-bold tracking-wider text-primary uppercase">{t("dashboard.agendaNextUp")}</span>
        <BookingStatusPill status={appointment.status} />
      </div>

      <div className="font-display text-3xl leading-tight tabular-nums">
        {formatTimeLabel(appointment.startAt, timezone, lang)}
        <span className="ml-1 font-sans text-sm font-medium text-base-content/60">–{formatTimeLabel(appointment.endAt, timezone, lang)}</span>
      </div>

      <div className="mt-1 text-base font-bold">{appointment.userName}</div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-[13px] text-base-content/65">
          <Icon name="design_services" size={16} />
          {serviceLabel(appointment, nameOf)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-base-content/65">
          <Icon name="person" size={16} />
          {appointment.professionalName ? nameOf(appointment.professionalName, appointment.professionalNameI18n) : t("bookings.anyProfessional")}
        </span>
      </div>
    </div>
  );
}
