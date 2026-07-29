import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import { addDays, dayOfMonth, formatWeekdayLabel, tenantDateString } from "../lib/tenantTime.js";
import { BookingCard } from "./BookingCard.js";
import type { ActionMenuItem } from "./ui/index.js";
import styles from "./BookingsWeekGrid.module.css";

interface BookingsWeekGridProps {
  /** Monday of the week being shown, "YYYY-MM-DD". */
  weekStart: string;
  appointments: AppointmentSummary[];
  timezone: string;
  actionsFor: (appointment: AppointmentSummary) => ActionMenuItem[];
  /** Clicking a column header drops into that single day. */
  onSelectDay: (date: string) => void;
}

/**
 * Seven day-columns, each a chronological stack of that day's bookings — the
 * view for "how busy is next week" rather than "who's next".
 *
 * Deliberately not a time-of-day grid with proportionally positioned blocks:
 * override bookings (R60) create genuinely overlapping appointments, which a
 * positioned grid has to invent a layout for. A stacked list shows both of them,
 * in order, without pretending the collision isn't there.
 */
export function BookingsWeekGrid({
  weekStart,
  appointments,
  timezone,
  actionsFor,
  onSelectDay,
}: BookingsWeekGridProps) {
  const { t, lang } = useI18n();
  const today = tenantDateString(timezone);
  const days = Array.from({ length: 7 }, (_, offset) => addDays(weekStart, offset));

  // Bucketed by the appointment's *tenant-local* day, which is the day the salon
  // sees it on — not the viewer's.
  const byDay = new Map<string, AppointmentSummary[]>(days.map((day) => [day, []]));
  for (const appointment of appointments) {
    byDay.get(tenantDateString(timezone, new Date(appointment.startAt)))?.push(appointment);
  }

  return (
    <div className={styles.scroll}>
      <div className={styles.grid}>
        {days.map((day) => {
          const dayAppointments = byDay.get(day) ?? [];
          return (
            <section key={day} className={cx(styles.column, day === today && styles.columnToday)}>
              <button type="button" className={styles.head} onClick={() => onSelectDay(day)}>
                <span className={styles.weekday}>{formatWeekdayLabel(day, lang)}</span>
                <span className={styles.dayNumber}>{dayOfMonth(day)}</span>
                {dayAppointments.length > 0 && <span className={styles.tally}>{dayAppointments.length}</span>}
              </button>
              <div className={styles.cards}>
                {dayAppointments.map((appointment) => (
                  <BookingCard
                    key={appointment.id}
                    appointment={appointment}
                    timezone={timezone}
                    actions={actionsFor(appointment)}
                  />
                ))}
                {dayAppointments.length === 0 && <p className={styles.empty}>{t("bookings.dayEmpty")}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
