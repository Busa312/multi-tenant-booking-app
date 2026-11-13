import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { cx } from "../lib/cx.js";
import { formatTimeLabel } from "../lib/tenantTime.js";
import { usePagination } from "../lib/usePagination.js";
import { BookingStatusPill } from "./BookingStatusPill.js";
import { Pagination } from "./ui/index.js";
import { NoShowBadge } from "./NoShowBadge.js";

// The dashboard is a glance: the rest of a long day is a page away.
const PAGE_SIZE = 8;

interface AgendaListProps {
  appointments: AppointmentSummary[];
  timezone: string;
}

/**
 * Today's remaining rows, compact.
 *
 * Not `BookingsDayTable`: that renders `price` unconditionally — the figure a
 * professional login must never see — and hard-requires a per-row action menu
 * and an 840px scroll container, none of which belongs in a dashboard card. What
 * it does share is `BookingStatusPill`, so the status→tone map stays in one
 * place. No price and no actions here for either role; the calendar owns those.
 */
export function AgendaList({ appointments, timezone }: AgendaListProps) {
  const { t, lang } = useI18n();
  const nameOf = useLocalizedName();
  const pager = usePagination(appointments, PAGE_SIZE);

  return (
    <>
    <ul className="divide-y divide-base-300">
      {pager.pageItems.map((appointment) => (
        <li
          key={appointment.id}
          // R90: cancelled rows stay visible as history, just visibly out of
          // play. The danger pill stays too — opacity alone isn't a signal.
          className={cx(
            "grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5 pointer-coarse:py-3.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_110px_96px]",
            appointment.status === "cancelled" && "opacity-60",
          )}
        >
          <div className="text-[13.5px] font-semibold whitespace-nowrap tabular-nums">{formatTimeLabel(appointment.startAt, timezone, lang)}</div>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold">{appointment.userName}</div>
            <div className="truncate text-xs text-base-content/60">{serviceLabel(appointment, nameOf)}</div>
            {appointment.notes && (
              <div className="mt-0.5 line-clamp-2 text-xs text-base-content/60 italic">{appointment.notes}</div>
            )}
            {appointment.status === "booked" && <NoShowBadge history={appointment.noShowHistory} className="mt-1" />}
          </div>
          <div className="hidden truncate text-[13px] text-base-content/60 sm:block">{appointment.professionalName ? nameOf(appointment.professionalName, appointment.professionalNameI18n) : t("bookings.anyProfessional")}</div>
          <div className="justify-self-end">
            <BookingStatusPill status={appointment.status} />
          </div>
        </li>
      ))}
    </ul>
    <Pagination {...pager} />
    </>
  );
}
