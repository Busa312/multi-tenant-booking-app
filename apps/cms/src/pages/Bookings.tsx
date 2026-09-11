import { useEffect, useMemo, useState } from "react";
import type { LocationSummary, AppointmentStatus, AppointmentSummary, ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
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
import { LocationTabs } from "../components/LocationTabs.js";
import { CreateBookingModal } from "../components/CreateBookingModal.js";
import { EditBookingModal } from "../components/EditBookingModal.js";
import { BookingsDayTable } from "../components/BookingsDayTable.js";
import { BookingsWeekGrid } from "../components/BookingsWeekGrid.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { type ActionMenuItem, Alert, Button, TextInput } from "../components/ui/index.js";
import styles from "./Bookings.module.css";

const DAY_ROW = "48px";
const WEEK_ROW = "74px";

interface PageContext {
  timezone: string;
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
  // R150: active branches only
  locations: LocationSummary[];
}

type View = "day" | "week";

export function BookingsPage() {
  const { t, lang } = useI18n();
  const { role, professionalId } = useAuth();
  const lockedProfessionalId = role === "professional" ? professionalId : null;

  const [context, setContext] = useState<PageContext | null>(null);

  const [date, setDate] = useState<string | null>(null);
  const [view, setView] = useState<View>("day");
  const [appointments, setAppointments] = useState<AppointmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // R150: null = every branch. Filtered here rather than refetched — the rows
  // are already loaded and carry their locationId, so switching tab is instant
  // and costs no request.
  const [locationId, setLocationId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentSummary | null>(null);

  const weekStart = date ? startOfWeek(date) : null;
  const range =
    date && weekStart ? (view === "week" ? { from: weekStart, to: addDays(weekStart, 6) } : { from: date, to: date }) : null;

  useEffect(() => {
    Promise.all([
      cachedApi.getTenant(),
      cachedApi.listServices(),
      cachedApi.listProfessionals(),
      cachedApi.listLocations(),
    ])
      .then(([tenant, services, professionals, locations]) => {
        setContext({
          timezone: tenant.timezone,
          services,
          professionals,
          locations: locations.filter((location) => location.isActive),
        });
        setDate(tenantDateString(tenant.timezone));
      })
      .catch(() => setError(t("bookings.errLoad")));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(
    () => (!appointments || !locationId ? appointments : appointments.filter((a) => a.locationId === locationId)),
    [appointments, locationId],
  );

  function load(from: string, to: string) {
    setAppointments(null);
    cachedApi
      .listAppointments({ from, to })
      .then(setAppointments)
      .catch(() => setError(t("bookings.errLoad")));
  }

  useEffect(() => {
    if (range) load(range.from, range.to);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to]);

  function goTo(day: string) {
    setError(null);
    setDate(day);
  }

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
    // R100: marking is manual
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
      items.push({
        label: t("bookings.actionRestore"),
        icon: "undo",
        onSelect: () => setStatus(appointment, "booked"),
      });
    }
    if (appointment.status !== "cancelled") {
      // R90: status change only
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

          <Button className={styles.add} icon="add" disabled={!context || !date} onClick={() => setCreateOpen(true)}>
            {t("bookings.add")}
          </Button>
        </div>

        {error && <Alert>{error}</Alert>}

        {context && (
          <LocationTabs locations={context.locations} selectedId={locationId} onSelect={setLocationId} />
        )}

        <div className={styles.count}>
          {visible
            ? t(view === "week" ? "bookings.countWeek" : "bookings.count", { count: visible.length })
            : t("common.loading")}
        </div>

        {visible && context && view === "day" && (
          <BookingsDayTable appointments={visible} timezone={context.timezone} actionsFor={rowActions} />
        )}

        {visible && context && view === "week" && weekStart && (
          <BookingsWeekGrid
            weekStart={weekStart}
            appointments={visible}
            timezone={context.timezone}
            actionsFor={rowActions}
            onSelectDay={(day) => {
              setView("day");
              goTo(day);
            }}
          />
        )}

        {(!appointments || !context) &&
          (view === "week" ? (
            <CardSkeleton rows={7} rowHeight={WEEK_ROW} />
          ) : (
            <CardSkeleton rows={6} rowHeight={DAY_ROW} />
          ))}
      </div>

      {createOpen && context && date && (
        <CreateBookingModal
          services={context.services}
          professionals={context.professionals}
          locations={context.locations}
          defaultLocationId={locationId}
          timezone={context.timezone}
          lockedProfessionalId={lockedProfessionalId}
          defaultDate={date}
          onClose={() => setCreateOpen(false)}
          onCreated={(bookedDate) => {
            setCreateOpen(false);

            showDay(bookedDate);
          }}
        />
      )}

      {rescheduleTarget && context && (
        <EditBookingModal
          appointment={rescheduleTarget}
          services={context.services}
          professionals={context.professionals}
          timezone={context.timezone}
          lockedProfessionalId={lockedProfessionalId}
          onClose={() => setRescheduleTarget(null)}
          onSaved={(movedDate) => {
            setRescheduleTarget(null);
            showDay(movedDate);
          }}
        />
      )}
    </AppShell>
  );
}
