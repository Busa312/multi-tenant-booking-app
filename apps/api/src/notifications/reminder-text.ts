/**
 * R610: the reminder text. Plain Latin (English day and month names keep it
 * GSM-7) and one SMS part (R500) for any salon address up to 80 characters —
 * so the wording shrinks as the link grows. Pure.
 */
import { zonedParts } from "../common/timezone.js";
import { smsParts } from "./sms-parts.js";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (value: number): string => String(value).padStart(2, "0");

/** "Tue 24 Nov 11:45", in the salon's time zone. */
export function reminderWhen(startAt: Date, timezone: string): string {
  const parts = zonedParts(startAt, timezone);
  const weekday = DAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()] ?? "";
  return `${weekday} ${parts.day} ${MONTHS[parts.month - 1] ?? ""} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** The longest wording that still fits one part; the last always does for an 80-character address. */
export function reminderText(startAt: Date, timezone: string, link: string): string {
  const when = reminderWhen(startAt, timezone);
  const wordings = [
    `Reminder: ${when}. Confirm or cancel: ${link}`,
    `Reminder ${when}. Confirm/cancel: ${link}`,
    `Visit ${when}: ${link}`,
  ];
  return wordings.find((text) => smsParts(text) === 1) ?? (wordings[wordings.length - 1] as string);
}
