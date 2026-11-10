import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { formatTimeLabel } from "../lib/tenantTime.js";
import { BookingStatusPill } from "./BookingStatusPill.js";
import { ActionMenu, type ActionMenuItem, Table, TableEmpty, TableHead, TableRow } from "./ui/index.js";

interface BookingsDayTableProps {
  appointments: AppointmentSummary[];
  timezone: string;
  actionsFor: (appointment: AppointmentSummary) => ActionMenuItem[];
}

const COLUMNS = "110px 1.4fr 1.3fr 1fr 110px 60px";

/**
 * One day in full: the working view for the desk, where phone number, price and
 * notes all matter. The week view trades those for breadth.
 */
export function BookingsDayTable({ appointments, timezone, actionsFor }: BookingsDayTableProps) {
  const { t, lang } = useI18n();
  const nameOf = useLocalizedName();

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
        {appointments.map((appointment) => (
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
              <div className="mt-0.5 text-xs text-base-content/60">{appointment.phoneNumber}</div>
              {appointment.notes && <div className="mt-1 line-clamp-2 text-xs text-base-content/60 italic">{appointment.notes}</div>}
            </div>
            <div>
              <div className="text-[13.5px]">{serviceLabel(appointment, nameOf)}</div>
              <div className="mt-0.5 text-xs text-base-content/60">{t("bookings.priceValue", { price: appointment.price })}</div>
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
    </div>
  );
}
