"use client";

import { useCallback, useMemo, useState } from "react";
import { localized } from "@booking/shared-types";
import type { Visit } from "@booking/shared-types";
import { translator, type Locale, type Messages } from "@/i18n/locales";
import { cancelBooking, rescheduleBooking } from "@/lib/actions";
import { addDays, formatInstant, todayInTimezone } from "@/lib/tenant-time";
import { PAGE_HEADING, SUMMARY, SUMMARY_ROW, SUMMARY_TERM } from "@/lib/wizardClasses";
import { RescheduleDialog } from "./RescheduleDialog";
import { VisitPlan } from "./VisitPlan";
import { CancelDialog } from "./CancelDialog";

interface ManageAppointmentProps {
  /** R230: the whole visit — every segment, managed together. */
  visit: Visit;
  token: string;
  timezone: string;
  locale: Locale;
  defaultLocale: string;
  messages: Messages;
  /** R300: online changes stop this many hours before the visit. */
  changeCutoffHours: number;
  /** R290 */
  maxAdvanceDays: number;
}

export function ManageAppointment({
  visit,
  token,
  timezone,
  locale,
  defaultLocale,
  messages,
  changeCutoffHours,
  maxAdvanceDays,
}: ManageAppointmentProps) {
  const t = useMemo(() => translator(messages), [messages]);
  // R160: service, branch and specialist names in the visitor's language
  const text = useCallback(
    (plain: string, i18n: unknown) => localized(plain, i18n, locale, defaultLocale),
    [locale, defaultLocale],
  );
  const [current, setCurrent] = useState(visit);
  const [dialog, setDialog] = useState<"reschedule" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCancelled = current.status === "cancelled";

  const isActionable = current.status === "booked" && new Date(current.startAt) > new Date();
  // R300: the API decides; this only spares the customer a dialog that would
  // be refused. `locked` catches a 403 from a page left open past the cutoff.
  const [locked, setLocked] = useState(false);
  const pastCutoff = Date.now() >= new Date(current.startAt).getTime() - changeCutoffHours * 3_600_000;
  const canChange = isActionable && !pastCutoff && !locked;

  const reschedule = async (date: string, time: string) => {
    const result = await rescheduleBooking(token, date, time);
    if (!result.ok) {
      if (result.reason === "tooLate") {
        setLocked(true);
        setDialog(null);
        return false;
      }
      setError(result.reason === "conflict" ? t("booking.details.slotTaken") : t("common.somethingWrong"));
      return false;
    }
    // R230: the link stays the same, so the address bar (and the SMS) still work
    setCurrent(result.visit);
    setDialog(null);
    setError(null);
    return true;
  };

  const cancel = async () => {
    const result = await cancelBooking(token);
    if (!result.ok) {
      if (result.reason === "tooLate") {
        setLocked(true);
        setDialog(null);
        return;
      }
      setError(t("common.somethingWrong"));
      return;
    }
    setCurrent(result.visit);
    setDialog(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className={PAGE_HEADING}>{t("manage.heading")}</h1>

      <p className={`badge badge-soft badge-lg -mt-2 font-semibold ${isCancelled ? "badge-error" : "badge-primary"}`}>
        {t(`manage.status.${current.status}`)}
      </p>

      <dl className={SUMMARY}>
        <div className={SUMMARY_ROW}>
          <dt className={SUMMARY_TERM}>{t("booking.summary.when")}</dt>
          <dd className="min-w-0 font-medium">{formatInstant(current.startAt, timezone, locale)}</dd>
        </div>
        {current.locationName && (
          <div className={SUMMARY_ROW}>
            <dt className={SUMMARY_TERM}>{t("booking.summary.location")}</dt>
            <dd className="min-w-0 font-medium">{text(current.locationName, current.locationNameI18n)}</dd>
          </div>
        )}
        <div className={SUMMARY_ROW}>
          <dt className={SUMMARY_TERM}>{t("booking.summary.schedule")}</dt>
          <dd className="-mb-3 min-w-0">
            {/* R200: every segment; one staff cancelled stays listed, marked as such */}
            <VisitPlan
              rows={current.segments.map((segment) => ({
                key: segment.appointmentId,
                startAt: segment.startAt,
                endAt: segment.endAt,
                services: segment.services.map((line) => text(line.name, line.nameI18n)).join(", "),
                professional: segment.professionalName && text(segment.professionalName, segment.professionalNameI18n),
                cancelled: segment.status === "cancelled" && !isCancelled,
              }))}
              timezone={timezone}
              locale={locale}
              t={t}
            />
          </dd>
        </div>
        <div className={SUMMARY_ROW}>
          <dt className={SUMMARY_TERM}>{t("booking.summary.total")}</dt>
          <dd className="text-xl font-extrabold tabular-nums">{current.price} ₾</dd>
        </div>
      </dl>

      {isCancelled && <p className="alert alert-soft alert-error">{t("manage.cancelled")}</p>}
      {error && (
        <p className="alert alert-soft alert-error" role="alert">
          {error}
        </p>
      )}

      {isActionable && !canChange && (
        <p className="alert alert-soft alert-info" role="status">
          {t("manage.tooLate")}
        </p>
      )}

      {canChange && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn btn-primary" onClick={() => setDialog("reschedule")}>
            {t("manage.reschedule")}
          </button>
          <button type="button" className="btn btn-outline btn-error" onClick={() => setDialog("cancel")}>
            {t("manage.cancel")}
          </button>
        </div>
      )}

      {dialog === "reschedule" && (
        <RescheduleDialog
          visit={current}
          token={token}
          timezone={timezone}
          lastDate={addDays(todayInTimezone(timezone), maxAdvanceDays)}
          locale={locale}
          onConfirm={reschedule}
          onClose={() => setDialog(null)}
          t={t}
        />
      )}

      {dialog === "cancel" && <CancelDialog onConfirm={cancel} onClose={() => setDialog(null)} t={t} />}
    </div>
  );
}
