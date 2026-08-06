import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { cx } from "../lib/cx.js";
import { formatTimeLabel } from "../lib/tenantTime.js";
import { BookingStatusPill } from "./BookingStatusPill.js";
import { ActionMenu, type ActionMenuItem } from "./ui/index.js";
import styles from "./BookingCard.module.css";

interface BookingCardProps {
  appointment: AppointmentSummary;
  timezone: string;
  actions: ActionMenuItem[];
}

/**
 * One appointment, compact enough for a week column. Carries the same actions as
 * a day-view row — the week is a different lens on the calendar, not a read-only
 * one.
 */
export function BookingCard({ appointment, timezone, actions }: BookingCardProps) {
  const { t, lang } = useI18n();

  return (
    // R90: a cancelled booking stays on the calendar as history, visibly out of play.
    <article className={cx(styles.card, appointment.status === "cancelled" && styles.cancelled)}>
      <div className={styles.head}>
        <span className={styles.time}>{formatTimeLabel(appointment.startAt, timezone, lang)}</span>
        <ActionMenu
          className={styles.menu}
          ariaLabel={t("common.rowActions", { name: appointment.userName })}
          items={actions}
        />
      </div>
      <div className={styles.name}>{appointment.userName}</div>
      <div className={styles.service}>{serviceLabel(appointment)}</div>
      {/* The professional is worth naming for an owner looking across the team;
          a professional login only ever sees their own rows, so it's redundant
          there but never wrong. */}
      {appointment.professionalName && <div className={styles.professional}>{appointment.professionalName}</div>}
      {appointment.status !== "booked" && (
        <div className={styles.status}>
          <BookingStatusPill status={appointment.status} />
        </div>
      )}
    </article>
  );
}
