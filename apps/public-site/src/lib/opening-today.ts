import type { OpeningHours } from "@booking/shared-types";
import type { PageContext } from "./page-context";
import { todayInTimezone } from "./tenant-time";

/** R390: "Open today 10:00–19:00" or "Closed today", on the salon's calendar. */
export function openingTodayLine(context: PageContext, hours: OpeningHours[]): string | null {
  if (hours.length === 0) {
    return null;
  }
  const weekday = new Date(`${todayInTimezone(context.tenant.timezone)}T00:00:00Z`).getUTCDay();
  const today = hours.find((day) => day.dayOfWeek === weekday);
  return today ? context.t("embed.openToday", { opens: today.opens, closes: today.closes }) : context.t("embed.closedToday");
}
