/**
 * R620: what a push notification to staff says. Pure: no config, no I/O.
 *
 * The day and month names are a copy of `DATE_NAMES` in
 * packages/shared-types/src/dates.ts (CLDR), which the API can't import at
 * runtime (CLAUDE.md §5). Keep the two in step.
 */
import type { PushLocale } from "@booking/shared-types";
import { zonedParts } from "../common/timezone.js";

export type BookingAlertKind = "booked" | "cancelled" | "rescheduled";

/** What a service worker needs to show one notification (apps/cms/public/sw.js). */
export interface PushPayload {
  title: string;
  body: string;
  /** Same tag = the newer notification replaces the older one (one per visit). */
  tag: string;
  /** Where tapping it goes, within the CMS. */
  url: string;
}

export interface BookingAlert {
  kind: BookingAlertKind;
  visitId: string;
  /** As the customer typed it; only the first word is shown. */
  customerName: string;
  /** The first service, with its translations (R160). */
  serviceName: string;
  serviceNameI18n: Record<string, string> | null;
  /** How many more services the visit has after the first. */
  moreServices: number;
  startAt: Date;
  timezone: string;
  /** R630: at the customer's address — said in the title; the address itself never travels in a push. */
  homeVisit?: boolean;
}

/** A language from a request; anything else is Georgian, the CMS's main audience. */
export function toPushLocale(value: unknown): PushLocale {
  return value === "en" || value === "ru" ? value : "ka";
}

const TITLES: Record<PushLocale, Record<BookingAlertKind, string>> = {
  en: { booked: "New booking", cancelled: "Booking cancelled", rescheduled: "Booking moved" },
  ka: { booked: "ახალი ჯავშანი", cancelled: "ჯავშანი გაუქმდა", rescheduled: "ჯავშანი გადაიტანეს" },
  ru: { booked: "Новая запись", cancelled: "Запись отменена", rescheduled: "Запись перенесена" },
};

// R630: the same, for a visit at the customer's address
const HOME_TITLES: Record<PushLocale, Record<BookingAlertKind, string>> = {
  en: { booked: "New home visit", cancelled: "Home visit cancelled", rescheduled: "Home visit moved" },
  ka: { booked: "ახალი ვიზიტი მისამართზე", cancelled: "ვიზიტი მისამართზე გაუქმდა", rescheduled: "ვიზიტი მისამართზე გადაიტანეს" },
  ru: { booked: "Новый выезд на дом", cancelled: "Выезд на дом отменён", rescheduled: "Выезд на дом перенесён" },
};

interface DateNames {
  weekdaysShort: readonly string[];
  monthsShort: readonly string[];
  day: (weekday: string, day: number, month: string) => string;
}

const DATE_NAMES: Record<PushLocale, DateNames> = {
  en: {
    weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    day: (weekday, day, month) => `${weekday}, ${month} ${day}`,
  },
  ka: {
    weekdaysShort: ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"],
    monthsShort: ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"],
    day: (weekday, day, month) => `${weekday}, ${day} ${month}`,
  },
  ru: {
    weekdaysShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    monthsShort: ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."],
    day: (weekday, day, month) => `${weekday}, ${day} ${month}`,
  },
};

const pad = (value: number): string => String(value).padStart(2, "0");

/** "Tue, Nov 24 11:45" in the salon's time zone, in the device's language. */
export function formatVisitTime(startAt: Date, timezone: string, locale: PushLocale): string {
  const parts = zonedParts(startAt, timezone);
  const names = DATE_NAMES[locale];
  const weekday = names.weekdaysShort[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()] ?? "";
  const month = names.monthsShort[parts.month - 1] ?? "";
  return `${names.day(weekday, parts.day, month)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** The salon-local day of the visit, for the Bookings link. */
function visitDate(startAt: Date, timezone: string): string {
  const parts = zonedParts(startAt, timezone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** The first word of the name: enough to recognise the visit, less on a lock screen. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function bookingAlertPayload(alert: BookingAlert, locale: PushLocale): PushPayload {
  const service = alert.serviceNameI18n?.[locale] || alert.serviceName;
  const services = alert.moreServices > 0 ? `${service} +${alert.moreServices}` : service;
  const body = [firstName(alert.customerName), services, formatVisitTime(alert.startAt, alert.timezone, locale)]
    .filter((part) => part.length > 0)
    .join(" · ");
  return {
    title: (alert.homeVisit ? HOME_TITLES : TITLES)[locale][alert.kind],
    body,
    tag: `visit-${alert.visitId}`,
    url: `/bookings?date=${visitDate(alert.startAt, alert.timezone)}`,
  };
}
