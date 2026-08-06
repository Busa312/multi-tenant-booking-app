import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { formatTimeLabel } from "../lib/tenantTime.js";
import { BookingStatusPill } from "./BookingStatusPill.js";
import { ActionMenu, type ActionMenuItem, Table, TableEmpty, TableHead, TableRow } from "./ui/index.js";
import styles from "./BookingsDayTable.module.css";

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

  return (
    <div className={styles.tableScroll}>
      <Table className={styles.table}>
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
            className={appointment.status === "cancelled" ? styles.rowCancelled : undefined}
          >
            <div className={styles.time}>
              {formatTimeLabel(appointment.startAt, timezone, lang)}
              <span className={styles.timeEnd}>{formatTimeLabel(appointment.endAt, timezone, lang)}</span>
            </div>
            <div>
              <div className={styles.name}>{appointment.userName}</div>
              <div className={styles.meta}>{appointment.phoneNumber}</div>
              {appointment.notes && <div className={styles.notes}>{appointment.notes}</div>}
            </div>
            <div>
              <div className={styles.cell}>{serviceLabel(appointment)}</div>
              <div className={styles.meta}>{t("bookings.priceValue", { price: appointment.price })}</div>
            </div>
            <div className={styles.cell}>{appointment.professionalName ?? t("bookings.anyProfessional")}</div>
            <div>
              <BookingStatusPill status={appointment.status} />
            </div>
            <div className={styles.actions}>
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
