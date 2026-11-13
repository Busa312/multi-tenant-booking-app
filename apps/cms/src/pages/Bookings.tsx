import { useEffect, useMemo, useState } from "react";
import type { LocationSummary, AppointmentStatus, AppointmentSummary, ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import {
  addDays,
  addMonths,
  formatDateLabel,
  formatMonthLabel,
  formatWeekLabel,
  startOfMonth,
  startOfWeek,
  tenantDateString,
} from "../lib/tenantTime.js";
import { ConfirmModal, type ConfirmRequest } from "../components/ConfirmModal.js";
import { AppShell } from "../components/AppShell.js";
import { LocationTabs } from "../components/LocationTabs.js";
import { CreateBookingModal } from "../components/CreateBookingModal.js";
import { EditBookingModal } from "../components/EditBookingModal.js";
import { BookingsDayTable } from "../components/BookingsDayTable.js";
import { BookingsWeekGrid } from "../components/BookingsWeekGrid.js";
import { BookingsMonthGrid } from "../components/BookingsMonthGrid.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { type ActionMenuItem, Alert, Button, TextInput } from "../components/ui/index.js";

const DAY_ROW = "48px";
const WEEK_ROW = "74px";
const MONTH_ROW = "104px";

const VIEWS = ["day", "week", "month"] as const;

interface PageContext {
  timezone: string;
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
  // R150: active branches only
  locations: LocationSummary[];
}

type View = (typeof VIEWS)[number];

// What the toolbar says in each view: its name, its arrows, its "back to now".
const STEP_LABELS: Record<View, { view: string; prev: string; next: string; now: string }> = {
  day: { view: "bookings.viewDay", prev: "bookings.prevDay", next: "bookings.nextDay", now: "bookings.today" },
  week: { view: "bookings.viewWeek", prev: "bookings.prevWeek", next: "bookings.nextWeek", now: "bookings.thisWeek" },
  month: { view: "bookings.viewMonth", prev: "bookings.prevMonth", next: "bookings.nextMonth", now: "bookings.thisMonth" },
};

export function BookingsPage() {
  const { t, lang } = useI18n();
  // The question waiting on an answer, if any (see ConfirmModal).
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
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
  // The month view loads whole weeks around the month, so its grid has no gaps.
  const range =
    date && weekStart
      ? view === "month"
        ? {
            from: startOfWeek(startOfMonth(date)),
            to: addDays(startOfWeek(addDays(addMonths(startOfMonth(date), 1), -1)), 6),
          }
        : view === "week"
          ? { from: weekStart, to: addDays(weekStart, 6) }
          : { from: date, to: date }
      : null;

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
    goTo(view === "month" ? addMonths(date, direction) : addDays(date, view === "week" ? 7 * direction : direction));
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

  function cancel(appointment: AppointmentSummary) {
    setConfirmRequest({
      title: t("bookings.actionCancel"),
      message: t("bookings.confirmCancel", { name: appointment.userName }),
      confirmLabel: t("bookings.actionCancel"),
      danger: true,
      run: () => void cancelConfirmed(appointment),
    });
  }

  async function cancelConfirmed(appointment: AppointmentSummary) {
    setError(null);
    try {
      await cachedApi.cancelAppointment(appointment.id);
      if (range) load(range.from, range.to);
    } catch {
      setError(t("bookings.errCancel"));
    }
  }

  // R380: blocks (or unblocks) the customer's number for this salon's online booking
  function setPhoneBlocked(appointment: AppointmentSummary, block: boolean) {
    const label = t(block ? "blocked.blockNumber" : "blocked.unblockNumber");
    setConfirmRequest({
      title: label,
      message: t(block ? "blocked.confirmBlock" : "blocked.confirmUnblock", { phone: appointment.phoneNumber }),
      confirmLabel: label,
      danger: block,
      run: () => {
        setError(null);
        const request = block
          ? cachedApi.blockPhone({ phoneNumber: appointment.phoneNumber })
          : cachedApi.unblockPhone({ phoneNumber: appointment.phoneNumber });
        request
          .then(() => {
            if (range) load(range.from, range.to);
          })
          .catch(() => setError(t("common.somethingWrong")));
      },
    });
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
    // R380: the owner's call, and only theirs
    if (role === "owner") {
      items.push(
        appointment.phoneBlocked
          ? { label: t("blocked.unblockNumber"), icon: "undo", onSelect: () => setPhoneBlocked(appointment, false) }
          : { label: t("blocked.blockNumber"), icon: "block", danger: true, onSelect: () => setPhoneBlocked(appointment, true) },
      );
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
    if (view === "month") return formatMonthLabel(date, lang);
    return view === "week" ? formatWeekLabel(range.from, range.to, lang) : formatDateLabel(date, lang);
  }

  return (
    <AppShell title={t("bookings.title")} subtitle={subtitle()}>
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Button
              iconOnly
              size="sm"
              variant="secondary"
              icon="chevron_left"
              title={t(STEP_LABELS[view].prev)}
              disabled={!date}
              onClick={() => step(-1)}
            />
            <TextInput
              type="date"
              className="input-sm w-40"
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
              title={t(STEP_LABELS[view].next)}
              disabled={!date}
              onClick={() => step(1)}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!context}
              onClick={() => context && goTo(tenantDateString(context.timezone))}
            >
              {t(STEP_LABELS[view].now)}
            </Button>
          </div>

          <div className="join" role="group" aria-label={t("bookings.viewLabel")}>
            {VIEWS.map((option) => (
              <Button
                key={option}
                size="sm"
                className="join-item"
                variant={view === option ? "primary" : "secondary"}
                aria-pressed={view === option}
                onClick={() => setView(option)}
              >
                {t(STEP_LABELS[option].view)}
              </Button>
            ))}
          </div>

          <Button className="w-full sm:ml-auto sm:w-auto" icon="add" disabled={!context || !date} onClick={() => setCreateOpen(true)}>
            {t("bookings.add")}
          </Button>
        </div>

        {error && <Alert>{error}</Alert>}

        {context && context.locations.length > 1 && (
          <div className="mb-4">
            <LocationTabs locations={context.locations} selectedId={locationId} onSelect={setLocationId} />
          </div>
        )}

        {visible && context && view === "day" && (
          <BookingsDayTable
            appointments={visible}
            listKey={`${date}:${locationId ?? "all"}`}
            timezone={context.timezone}
            actionsFor={rowActions}
          />
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

        {visible && context && view === "month" && date && range && (
          <BookingsMonthGrid
            from={range.from}
            to={range.to}
            month={date}
            appointments={visible}
            timezone={context.timezone}
            onSelectDay={(day) => {
              setView("day");
              goTo(day);
            }}
          />
        )}

        {(!appointments || !context) &&
          (view === "month" ? (
            <CardSkeleton rows={5} rowHeight={MONTH_ROW} subtitle={false} />
          ) : view === "week" ? (
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
      {confirmRequest && <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />}
    </AppShell>
  );
}
