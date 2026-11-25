import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { cx } from "../lib/cx.js";
import { formatTimeLabel } from "../lib/tenantTime.js";
import { BookingStatusPill } from "./BookingStatusPill.js";
import { NoShowBadge } from "./NoShowBadge.js";
import { BlockedBadge } from "./BlockedBadge.js";
import { ConfirmedBadge } from "./ConfirmedBadge.js";
import { ActionMenu, type ActionMenuItem } from "./ui/index.js";

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
  const nameOf = useLocalizedName();

  return (
    // R90: a cancelled booking stays on the calendar as history, visibly out of play.
    <article
      className={cx(
        "rounded-field border border-l-[3px] border-base-300 bg-base-100 px-2 py-1.5",
        appointment.status === "cancelled" ? "border-l-error opacity-60" : "border-l-primary",
      )}
    >
      <div className="flex items-center gap-1">
        <span className="text-xs font-semibold tabular-nums">{formatTimeLabel(appointment.startAt, timezone, lang)}</span>
        <ActionMenu
          className="-mr-1 ml-auto"
          ariaLabel={t("common.rowActions", { name: appointment.userName })}
          items={actions}
        />
      </div>
      <div className="mt-0.5 truncate text-[13px] font-semibold">{appointment.userName}</div>
      <div className="truncate text-xs text-base-content/60">{serviceLabel(appointment, nameOf)}</div>
      {/* The professional is worth naming for an owner looking across the team;
          a professional login only ever sees their own rows, so it's redundant
          there but never wrong. */}
      {appointment.professionalName && (
        <div className="truncate text-xs text-base-content/60">
          {nameOf(appointment.professionalName, appointment.professionalNameI18n)}
        </div>
      )}
      {appointment.status !== "booked" && (
        <div className="mt-1">
          <BookingStatusPill status={appointment.status} />
        </div>
      )}
      {/* R360: only worth the room on a booking that is still to happen */}
      {appointment.status === "booked" && <NoShowBadge history={appointment.noShowHistory} className="mt-1 max-w-full" />}
      {appointment.status === "booked" && <BlockedBadge blocked={appointment.phoneBlocked} className="mt-1" />}
      {/* R610 */}
      <ConfirmedBadge appointment={appointment} className="mt-1 block" />
    </article>
  );
}
