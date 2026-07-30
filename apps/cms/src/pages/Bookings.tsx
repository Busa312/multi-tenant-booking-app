import { useEffect, useState } from "react";
import type { AppointmentStatus, AppointmentSummary, ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import {
  addDays,
  formatDateLabel,
  formatWeekLabel,
  startOfWeek,
  tenantDateString,
} from "../lib/tenantTime.js";
import { AppShell } from "../components/AppShell.js";
import { CreateBookingModal } from "../components/CreateBookingModal.js";
import { RescheduleBookingModal } from "../components/RescheduleBookingModal.js";
import { BookingsDayTable } from "../components/BookingsDayTable.js";
import { BookingsWeekGrid } from "../components/BookingsWeekGrid.js";
import { type ActionMenuItem, Alert, Button, TextInput } from "../components/ui/index.js";
import styles from "./Bookings.module.css";

/** Everything that doesn't change as the visible day moves. */
interface PageContext {
  timezone: string;
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
}

type View = "day" | "week";

/**
 * The salon's calendar: phone bookings, walk-ins and off-site changes all land
 * here alongside the public-site ones (R10).
 *
 * A `professional` login sees only their own appointments — enforced by the API
 * (R20); this page never has the others to render in the first place.
 */
export function BookingsPage() {
  const { t, lang } = useI18n();
  const { role, professionalId } = useAuth();
  const lockedProfessionalId = role === "professional" ? professionalId : null;

  const [context, setContext] = useState<PageContext | null>(null);
  // Null until the tenant's timezone is known — "today" is the salon's today,
  // which the staff browser's clock can't answer on its own.
  const [date, setDate] = useState<string | null>(null);
  const [view, setView] = useState<View>("day");
  const [appointments, setAppointments] = useState<AppointmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentSummary | null>(null);

  // The fetched span: one day, or the Monday-based week the day falls in.
  const weekStart = date ? startOfWeek(date) : null;
  const range =
    date && weekStart ? (view === "week" ? { from: weekStart, to: addDays(weekStart, 6) } : { from: date, to: date }) : null;

  useEffect(() => {
    Promise.all([cachedApi.getTenant(), cachedApi.listServices(), cachedApi.listProfessionals()])
      .then(([tenant, services, professionals]) => {
        setContext({ timezone: tenant.timezone, services, professionals });
        setDate(tenantDateString(tenant.timezone));
      })
      .catch(() => setError(t("bookings.errLoad")));
    // Fetch once on mount; a language switch shouldn't trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load(from: string, to: string) {
    setAppointments(null);
    cachedApi
      .listAppointments({ from, to })
      .then(setAppointments)
      .catch(() => setError(t("bookings.errLoad")));
  }

  useEffect(() => {
    if (range) load(range.from, range.to);
    // Refetch when the span moves — in week view that's only when the week
    // changes, not on every day within it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to]);

  function goTo(day: string) {
    setError(null);
    setDate(day);
  }

  /** After a write: show the day it landed on, reloading if it's already in view. */
  function showDay(day: string) {
    if (range && day >= range.from && day <= range.to) {
      load(range.from, range.to);
    } else {
      goTo(day);
    }
  }

  function step(direction: -1 | 1) {
    if (!date) return;
    goTo(addDays(date, view === "week" ? 7 * direction : direction));
  }

  async function setStatus(appointment: AppointmentSummary, status: Exclude<AppointmentStatus, "cancelled">) {
    setError(null);
    try {
      await cachedApi.updateAppointmentStatus(appointment.id, { status });
      if (range) load(range.from, range.to);
    } catch {
      setError(t("bookings.errStatus"));
    }
  }

  async function cancel(appointment: AppointmentSummary) {
    if (!window.confirm(t("bookings.confirmCancel", { name: appointment.userName }))) return;
    setError(null);
    try {
      await cachedApi.cancelAppointment(appointment.id);
      if (range) load(range.from, range.to);
    } catch {
      setError(t("bookings.errCancel"));
    }
  }

  function rowActions(appointment: AppointmentSummary): ActionMenuItem[] {
    const items: ActionMenuItem[] = [];
    if (appointment.status !== "cancelled") {
      items.push({
        label: t("bookings.actionReschedule"),
        icon: "edit_calendar",
        onSelect: () => setRescheduleTarget(appointment),
      });
    }
    // R100: marking is manual, always — nothing here happens because a time passed.
    if (appointment.status !== "completed") {
      items.push({
        label: t("bookings.actionComplete"),
        icon: "check_circle",
        onSelect: () => setStatus(appointment, "completed"),
      });
    }
    if (appointment.status !== "no_show") {
      items.push({
        label: t("bookings.actionNoShow"),
        icon: "person_off",
        onSelect: () => setStatus(appointment, "no_show"),
      });
    }
    if (appointment.status !== "booked") {
      // The way back from a mis-click, and how a cancelled booking is revived.
      items.push({
        label: t("bookings.actionRestore"),
        icon: "undo",
        onSelect: () => setStatus(appointment, "booked"),
      });
    }
    if (appointment.status !== "cancelled") {
      // R90: status change only — the row stays in history either way.
      items.push({
        label: t("bookings.actionCancel"),
        icon: "event_busy",
        danger: true,
        onSelect: () => cancel(appointment),
      });
    }
    return items;
  }

  function subtitle(): string {
    if (!date || !range) return t("bookings.subtitle");
    return view === "week" ? formatWeekLabel(range.from, range.to, lang) : formatDateLabel(date, lang);
  }

  return (
    <AppShell title={t("bookings.title")} subtitle={subtitle()}>
      <div className="fade-up">
        <div className={styles.toolbar}>
          <div className={styles.dayNav}>
            <Button
              iconOnly
              size="sm"
              variant="secondary"
              icon="chevron_left"
              title={t(view === "week" ? "bookings.prevWeek" : "bookings.prevDay")}
              disabled={!date}
              onClick={() => step(-1)}
            />
            <TextInput
              type="date"
              className={styles.dateInput}
              aria-label={t("bookings.dateLabel")}
              value={date ?? ""}
              disabled={!date}
              onChange={(e) => e.target.value && goTo(e.target.value)}
            />
            <Button
              iconOnly
              size="sm"
              variant="secondary"
              icon="chevron_right"
              title={t(view === "week" ? "bookings.nextWeek" : "bookings.nextDay")}
              disabled={!date}
              onClick={() => step(1)}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!context}
              onClick={() => context && goTo(tenantDateString(context.timezone))}
            >
              {t(view === "week" ? "bookings.thisWeek" : "bookings.today")}
            </Button>
          </div>

          {/* Two buttons rather than a Select: two mutually exclusive layouts,
              both worth reaching in one click. */}
          <div className={styles.viewToggle} role="group" aria-label={t("bookings.viewLabel")}>
            <Button
              size="sm"
              variant={view === "day" ? "primary" : "secondary"}
              aria-pressed={view === "day"}
              onClick={() => setView("day")}
            >
              {t("bookings.viewDay")}
            </Button>
            <Button
              size="sm"
              variant={view === "week" ? "primary" : "secondary"}
              aria-pressed={view === "week"}
              onClick={() => setView("week")}
            >
              {t("bookings.viewWeek")}
            </Button>
          </div>

          {/* Disabled until the service and professional rosters are in — the
              create form can't be rendered without them. */}
          <Button className={styles.add} icon="add" disabled={!context || !date} onClick={() => setCreateOpen(true)}>
            {t("bookings.add")}
          </Button>
        </div>

        {error && <Alert>{error}</Alert>}

        <div className={styles.count}>
          {appointments
            ? t(view === "week" ? "bookings.countWeek" : "bookings.count", { count: appointments.length })
            : t("common.loading")}
        </div>

        {appointments && context && view === "day" && (
          <BookingsDayTable appointments={appointments} timezone={context.timezone} actionsFor={rowActions} />
        )}

        {appointments && context && view === "week" && weekStart && (
          <BookingsWeekGrid
            weekStart={weekStart}
            appointments={appointments}
            timezone={context.timezone}
            actionsFor={rowActions}
            onSelectDay={(day) => {
              setView("day");
              goTo(day);
            }}
          />
        )}
      </div>

      {createOpen && context && date && (
        <CreateBookingModal
          services={context.services}
          professionals={context.professionals}
          timezone={context.timezone}
          lockedProfessionalId={lockedProfessionalId}
          defaultDate={date}
          onClose={() => setCreateOpen(false)}
          onCreated={(bookedDate) => {
            setCreateOpen(false);
            // Jump to the day it landed on, so the new booking is on screen even
            // when it was made for next week.
            showDay(bookedDate);
          }}
        />
      )}

      {rescheduleTarget && context && (
        <RescheduleBookingModal
          appointment={rescheduleTarget}
          professionals={context.professionals}
          timezone={context.timezone}
          lockedProfessionalId={lockedProfessionalId}
          onClose={() => setRescheduleTarget(null)}
          onRescheduled={(movedDate) => {
            setRescheduleTarget(null);
            showDay(movedDate);
          }}
        />
      )}
    </AppShell>
  );
}
