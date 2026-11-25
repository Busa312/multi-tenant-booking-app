import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { formatTimeLabel } from "../lib/tenantTime.js";
import { BookingStatusPill } from "./BookingStatusPill.js";
import { NoShowBadge } from "./NoShowBadge.js";
import { BlockedBadge } from "./BlockedBadge.js";
import { ConfirmedBadge } from "./ConfirmedBadge.js";
import { HomeVisitAddress } from "./HomeVisitAddress.js";
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
    <div className="mb-4 border-l-4 border-primary bg-base-200/70 px-4 py-4 sm:px-5">
      <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-content">{t("dashboard.agendaNextUp")}</span>
        <BookingStatusPill status={appointment.status} />
        <ConfirmedBadge appointment={appointment} />
        <NoShowBadge history={appointment.noShowHistory} />
        <BlockedBadge blocked={appointment.phoneBlocked} />
      </div>

      <div className="font-display text-5xl leading-none font-bold tabular-nums">
        {formatTimeLabel(appointment.startAt, timezone, lang)}
        <span className="ml-1.5 font-sans text-base font-medium text-base-content/60">–{formatTimeLabel(appointment.endAt, timezone, lang)}</span>
      </div>

      <div className="mt-2 text-base font-bold">{appointment.userName}</div>

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

      {/* R630: where to go, in full — this is the visit about to start */}
      <HomeVisitAddress appointment={appointment} className="mt-3" />

      {/* What the desk was told when the booking was taken — in full here, since
          this is the appointment about to walk in. */}
      {appointment.notes && (
        <p className="mt-3 border-t border-base-300 pt-2.5 text-[13px] whitespace-pre-line">{appointment.notes}</p>
      )}
    </div>
  );
}
