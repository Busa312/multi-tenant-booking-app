import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { cx } from "../lib/cx.js";
import { formatTimeLabel } from "../lib/tenantTime.js";
import { BookingStatusPill } from "./BookingStatusPill.js";
import styles from "./AgendaList.module.css";

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

  return (
    <ul className={styles.list}>
      {appointments.map((appointment) => (
        <li
          key={appointment.id}
          // R90: cancelled rows stay visible as history, just visibly out of
          // play. The danger pill stays too — opacity alone isn't a signal.
          className={cx(styles.row, appointment.status === "cancelled" && styles.rowCancelled)}
        >
          <div className={styles.time}>{formatTimeLabel(appointment.startAt, timezone, lang)}</div>
          <div className={styles.who}>
            <div className={styles.name}>{appointment.userName}</div>
            <div className={styles.service}>{serviceLabel(appointment)}</div>
          </div>
          <div className={styles.professional}>{appointment.professionalName ?? t("bookings.anyProfessional")}</div>
          <div className={styles.status}>
            <BookingStatusPill status={appointment.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
