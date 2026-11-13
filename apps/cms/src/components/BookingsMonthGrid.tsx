import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import {
  addDays,
  dayOfMonth,
  formatDateLabel,
  formatWeekdayLabel,
  tenantDateString,
  tenantTimeString,
} from "../lib/tenantTime.js";

interface BookingsMonthGridProps {
  /** First and last day drawn — whole Monday-to-Sunday weeks around the month. */
  from: string;
  to: string;
  /** Any day of the month in focus; days outside it are drawn muted. */
  month: string;
  appointments: AppointmentSummary[];
  timezone: string;
  /** Clicking a day drops into that single day, where the actions are. */
  onSelectDay: (date: string) => void;
}

// How many bookings a day cell names before folding the rest into "+N more".
const SHOWN = 3;

/**
 * The month as a wall calendar — the view for "which days are filling up".
 *
 * It shows what's *held*: cancelled bookings stay out, because here they'd
 * read as load. They remain visible, as history (R90), in the day and week
 * views. No per-booking actions either; a day is one click away.
 */
export function BookingsMonthGrid({ from, to, month, appointments, timezone, onSelectDay }: BookingsMonthGridProps) {
  const { t, lang } = useI18n();
  const today = tenantDateString(timezone);
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);

  // Bucketed by the appointment's *tenant-local* day — the day the salon sees it on.
  const byDay = new Map<string, AppointmentSummary[]>(days.map((day) => [day, []]));
  for (const appointment of appointments) {
    if (appointment.status === "cancelled") continue;
    byDay.get(tenantDateString(timezone, new Date(appointment.startAt)))?.push(appointment);
  }

  return (
    <div className="overflow-hidden rounded-box border border-base-300 bg-base-300">
      <div className="grid grid-cols-7 gap-px" aria-hidden="true">
        {days.slice(0, 7).map((day) => (
          <div key={day} className="bg-base-200 px-2 py-1.5 text-xs font-semibold text-base-content/65">
            {formatWeekdayLabel(day, lang)}
          </div>
        ))}
      </div>
      <ul className="mt-px grid grid-cols-7 gap-px">
        {days.map((day) => {
          const held = byDay.get(day) ?? [];
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          return (
            <li key={day} className="min-w-0">
              <button
                type="button"
                className={cx(
                  "flex h-full min-h-16 w-full cursor-pointer flex-col gap-1 p-1.5 text-left transition-colors hover:bg-base-200 motion-reduce:transition-none md:min-h-28 md:p-2",
                  inMonth ? "bg-base-100" : "bg-base-200/60 text-base-content/45",
                )}
                aria-label={`${formatDateLabel(day, lang)}: ${t("bookings.count", { count: held.length })}`}
                onClick={() => onSelectDay(day)}
              >
                <span className="flex w-full items-baseline justify-between gap-1">
                  {/* The highlighter marks today, as it does on the dashboard. */}
                  <span
                    className={cx(
                      "font-display text-lg leading-none font-bold tabular-nums",
                      day === today && "bg-accent px-1.5 py-0.5 text-accent-content",
                    )}
                  >
                    {dayOfMonth(day)}
                  </span>
                  {/* A phone has no room for names: the count stands in for them. */}
                  {held.length > 0 && (
                    <span className="text-xs font-semibold tabular-nums md:hidden">{held.length}</span>
                  )}
                </span>
                {held.slice(0, SHOWN).map((appointment) => (
                  <span key={appointment.id} className="hidden w-full truncate text-xs md:block">
                    <span className="font-semibold tabular-nums">{tenantTimeString(appointment.startAt, timezone)}</span>{" "}
                    {appointment.userName}
                  </span>
                ))}
                {held.length > SHOWN && (
                  <span className="hidden text-xs text-base-content/60 md:block">
                    {t("bookings.monthMore", { count: held.length - SHOWN })}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
