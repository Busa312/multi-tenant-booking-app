import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { formatTimeLabel } from "../lib/tenantTime.js";
import { BookingStatusPill } from "./BookingStatusPill.js";
import { Icon } from "./ui/index.js";
import styles from "./AgendaNextUp.module.css";

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

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <span className={styles.label}>{t("dashboard.agendaNextUp")}</span>
        <BookingStatusPill status={appointment.status} />
      </div>

      <div className={styles.time}>
        {formatTimeLabel(appointment.startAt, timezone, lang)}
        <span className={styles.timeEnd}>–{formatTimeLabel(appointment.endAt, timezone, lang)}</span>
      </div>

      <div className={styles.name}>{appointment.userName}</div>

      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <Icon name="design_services" size={16} />
          {serviceLabel(appointment)}
        </span>
        <span className={styles.metaItem}>
          <Icon name="person" size={16} />
          {appointment.professionalName ?? t("bookings.anyProfessional")}
        </span>
      </div>
    </div>
  );
}
