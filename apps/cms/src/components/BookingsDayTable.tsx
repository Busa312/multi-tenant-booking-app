import type { AppointmentSummary } from "@booking/shared-types";
import { priceLabel } from "../lib/priceLabel.js";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { usePagination } from "../lib/usePagination.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { formatTimeLabel } from "../lib/tenantTime.js";
import { BookingStatusPill } from "./BookingStatusPill.js";
import { NoShowBadge } from "./NoShowBadge.js";
import { BlockedBadge } from "./BlockedBadge.js";
import { ActionMenu, type ActionMenuItem, Table, TableEmpty, TableHead, TableRow, Pagination } from "./ui/index.js";
import { formatPhone } from "../lib/formatPhone.js";

interface BookingsDayTableProps {
  appointments: AppointmentSummary[];
  /** Changes when this becomes a different list (another day, another branch): paging starts over. */
  listKey: string;
  timezone: string;
  actionsFor: (appointment: AppointmentSummary) => ActionMenuItem[];
}

const COLUMNS = "110px 1.4fr 1.3fr 1fr 110px 60px";
// A full day at a busy salon runs past one screen; a pager appears beyond this.
const PAGE_SIZE = 15;

/**
 * One day in full: the working view for the desk, where phone number, price and
 * notes all matter. The week view trades those for breadth.
 */
export function BookingsDayTable({ appointments, listKey, timezone, actionsFor }: BookingsDayTableProps) {
  const { t, lang } = useI18n();
  const nameOf = useLocalizedName();
  const pager = usePagination(appointments, PAGE_SIZE, listKey);

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[840px]">
        <TableHead columns={COLUMNS}>
          <div>{t("bookings.colTime")}</div>
          <div>{t("bookings.colCustomer")}</div>
          <div>{t("bookings.colService")}</div>
          <div>{t("bookings.colProfessional")}</div>
          <div>{t("bookings.colStatus")}</div>
          <div></div>
        </TableHead>
        {pager.pageItems.map((appointment) => (
          <TableRow
            key={appointment.id}
            columns={COLUMNS}
            // R90: cancelled rows stay visible as history, just visibly out of play.
            className={appointment.status === "cancelled" ? "opacity-60" : undefined}
          >
            <div className="text-[13.5px] font-semibold tabular-nums">
              {formatTimeLabel(appointment.startAt, timezone, lang)}
              <span className="block font-normal text-base-content/55">{formatTimeLabel(appointment.endAt, timezone, lang)}</span>
            </div>
            <div>
              <div className="font-semibold">{appointment.userName}</div>
              <div className="mt-0.5 text-xs text-base-content/60">{formatPhone(appointment.phoneNumber)}</div>
              <div className="mt-1 flex flex-wrap gap-1 empty:hidden">
                <BlockedBadge blocked={appointment.phoneBlocked} />
                <NoShowBadge history={appointment.noShowHistory} />
              </div>
              {appointment.notes && <div className="mt-1 line-clamp-2 text-xs text-base-content/60 italic">{appointment.notes}</div>}
            </div>
            <div>
              <div className="text-[13.5px]">{serviceLabel(appointment, nameOf)}</div>
              <div className="mt-0.5 text-xs text-base-content/60">{/* R520 */}
                {priceLabel(t, appointment.price, appointment.services.some((line) => line.priceFrom))}</div>
            </div>
            <div className="text-[13.5px]">{appointment.professionalName ? nameOf(appointment.professionalName, appointment.professionalNameI18n) : t("bookings.anyProfessional")}</div>
            <div>
              <BookingStatusPill status={appointment.status} />
            </div>
            <div className="flex justify-end">
              <ActionMenu
                ariaLabel={t("common.rowActions", { name: appointment.userName })}
                items={actionsFor(appointment)}
              />
            </div>
          </TableRow>
        ))}
        {appointments.length === 0 && <TableEmpty>{t("bookings.empty")}</TableEmpty>}
      </Table>
      <Pagination {...pager} />
    </div>
  );
}
