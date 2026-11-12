import { useEffect, useMemo, useState } from "react";
import type {
  AppointmentSummary,
  DashboardSummary,
  LocationSummary,
  ProfessionalSummary,
  ServiceSummary,
} from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { dashboardRange, todaysAgenda, type DashboardRange } from "../lib/dashboardStats.js";
import { tenantDateString } from "../lib/tenantTime.js";
import { AppShell } from "../components/AppShell.js";
import { LocationTabs } from "../components/LocationTabs.js";
import { CreateBookingModal } from "../components/CreateBookingModal.js";
import { DashboardQuickActions, type BookingBlocker } from "../components/DashboardQuickActions.js";
import { TodayAgendaCard } from "../components/TodayAgendaCard.js";
import { NeedsMarkingCard } from "../components/NeedsMarkingCard.js";
import { WeekAheadCard } from "../components/WeekAheadCard.js";
import { PeriodStatsCard } from "../components/PeriodStatsCard.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { Alert } from "../components/ui/index.js";

const AGENDA_ROW = "58px";
const WEEK_ROW = "28px";
const STAT_GROUP = "112px";

interface PageContext {
  tenantName: string;
  subdomain: string;
  timezone: string;
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
  // R150: active branches only
  locations: LocationSummary[];

  today: string;
  range: DashboardRange;
}

const TICK_MS = 60_000;

export function DashboardPage() {
  const { t } = useI18n();
  const { role, professionalId } = useAuth();

  const [context, setContext] = useState<PageContext | null>(null);
  const [appointments, setAppointments] = useState<AppointmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // R150: null = every branch. The agenda filters `appointments` here; the
  // R370 summary is asked for per branch, so every card follows the tab.
  const [locationId, setLocationId] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);

  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    Promise.all([
      cachedApi.getTenant(),
      cachedApi.listServices(),
      cachedApi.listProfessionals(),
      cachedApi.listLocations(),
    ])
      .then(([tenant, services, professionals, locations]) => {
        setContext({
          tenantName: tenant.name,
          subdomain: tenant.subdomain,
          timezone: tenant.timezone,
          services,
          professionals,
          locations: locations.filter((location) => location.isActive),
          today: tenantDateString(tenant.timezone),
          range: dashboardRange(tenant.timezone),
        });
      })
      .catch(() => setError(t("dashboard.errLoad")));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const range = context?.range;

  function load(from: string, to: string) {
    const { cached, fresh } = cachedApi.listDashboardAppointments({ from, to });

    setAppointments(cached);
    fresh.then(setAppointments).catch(() => setError(t("dashboard.errLoad")));
  }

  useEffect(() => {
    if (range) load(range.from, range.to);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to]);

  // R370: one call for every number below the agenda
  function loadSummary(forLocationId: string | null) {
    cachedApi
      .getDashboard(forLocationId ? { locationId: forLocationId } : {})
      .then(setSummary)
      .catch(() => setError(t("dashboard.errLoad")));
  }

  useEffect(() => {
    setSummary(null);
    loadSummary(locationId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  // R100: a person says whether the client came; then every number is redone
  async function markStatus(appointment: AppointmentSummary, status: "completed" | "no_show") {
    setSavingId(appointment.id);
    setMarkError(null);
    try {
      await cachedApi.updateAppointmentStatus(appointment.id, { status });
      loadSummary(locationId);
      if (range) load(range.from, range.to);
    } catch {
      setMarkError(t("dashboard.markFailed"));
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick((n) => n + 1);

      setContext((current) => {
        if (!current) return current;
        const today = tenantDateString(current.timezone);
        if (today === current.today) return current;
        return { ...current, today, range: dashboardRange(current.timezone) };
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const visible = useMemo(
    () => (!appointments || !locationId ? appointments : appointments.filter((a) => a.locationId === locationId)),
    [appointments, locationId],
  );

  const agenda = useMemo(() => {
    if (!visible || !context) return null;
    return todaysAgenda(visible, context.timezone, new Date());

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, context, nowTick]);

  const activeServices = context?.services.filter((service) => service.isActive) ?? [];
  const activeProfessionals = context?.professionals.filter((professional) => professional.isActive) ?? [];

  const canBookAsRole = role !== "professional" || professionalId !== null;

  const blocker: BookingBlocker | null =
    !context || !canBookAsRole
      ? null
      : activeServices.length === 0
        ? "no-services"
        : activeProfessionals.length === 0
          ? "no-professionals"
          : null;
  const canBook = context !== null && canBookAsRole && blocker === null;

  return (
    <AppShell
      title={context ? t("dashboard.welcome") : t("common.loading")}
      subtitle={context?.tenantName}
      tenantSubdomain={context?.subdomain}
    >
      <div className="grid animate-fade-up items-start gap-4 motion-reduce:animate-none xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:gap-5">
        {error && <Alert flush className="xl:col-span-2">{error}</Alert>}

        {context && (
          <div className="xl:col-span-2">
            <LocationTabs locations={context.locations} selectedId={locationId} onSelect={setLocationId} />
          </div>
        )}

        <div className="xl:col-span-2">
          <DashboardQuickActions
            role={role}
            onNewBooking={() => setCreateOpen(true)}
            canBook={canBook}
            blocker={blocker}
          />
        </div>

        <div className="xl:col-span-2">
          {agenda && context ? (
            <TodayAgendaCard agenda={agenda} timezone={context.timezone} isOwnOnly={role === "professional"} />
          ) : (
            <CardSkeleton rows={4} rowHeight={AGENDA_ROW} />
          )}
        </div>

        {summary && context && summary.unmarkedCount > 0 && (
          <div className="xl:col-span-2">
            <NeedsMarkingCard
              appointments={summary.unmarked}
              count={summary.unmarkedCount}
              timezone={context.timezone}
              savingId={savingId}
              error={markError}
              onMark={markStatus}
            />
          </div>
        )}

        <div className="xl:col-span-2">
          {summary ? (
            <WeekAheadCard days={summary.week} isOwnOnly={role === "professional"} />
          ) : (
            <CardSkeleton rows={7} rowHeight={WEEK_ROW} />
          )}
        </div>

        <div className="xl:col-span-2">
          {summary ? (
            <PeriodStatsCard current={summary.current} previous={summary.previous} />
          ) : (
            <CardSkeleton rows={2} rowHeight={STAT_GROUP} />
          )}
        </div>
      </div>

      {createOpen && context && (
        <CreateBookingModal
          services={context.services}
          professionals={context.professionals}
          locations={context.locations}
          defaultLocationId={locationId}
          timezone={context.timezone}
          lockedProfessionalId={role === "professional" ? professionalId : null}
          defaultDate={context.today}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);

            load(context.range.from, context.range.to);
            loadSummary(locationId);
          }}
        />
      )}
    </AppShell>
  );
}
