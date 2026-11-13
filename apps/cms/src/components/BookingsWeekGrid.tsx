import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import { addDays, dayOfMonth, formatWeekdayLabel, tenantDateString } from "../lib/tenantTime.js";
import { BookingCard } from "./BookingCard.js";
import type { ActionMenuItem } from "./ui/index.js";

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
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[900px] grid-cols-[repeat(7,minmax(148px,1fr))] gap-2">
        {days.map((day) => {
          const dayAppointments = byDay.get(day) ?? [];
          return (
            <section
              key={day}
              className={cx(
                "flex flex-col gap-2 rounded-box border bg-base-100/60 p-2",
                day === today ? "border-primary/60 bg-primary/5" : "border-base-300",
              )}
            >
              <button
                type="button"
                className="group flex w-full cursor-pointer items-baseline gap-1.5 border-b border-base-300 px-0.5 pb-1.5 text-left"
                onClick={() => onSelectDay(day)}
              >
                <span className="text-xs text-base-content/60">{formatWeekdayLabel(day, lang)}</span>
                <span className="font-display text-2xl leading-none font-bold group-hover:underline">{dayOfMonth(day)}</span>
                {dayAppointments.length > 0 && <span className="badge ml-auto badge-xs border-none bg-primary/12 font-semibold text-primary tabular-nums">{dayAppointments.length}</span>}
              </button>
              <div className="grid content-start gap-1.5">
                {dayAppointments.map((appointment) => (
                  <BookingCard
                    key={appointment.id}
                    appointment={appointment}
                    timezone={timezone}
                    actions={actionsFor(appointment)}
                  />
                ))}
                {dayAppointments.length === 0 && <p className="px-0.5 text-xs text-base-content/45">{t("bookings.dayEmpty")}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
