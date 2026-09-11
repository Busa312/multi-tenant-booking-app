import { useEffect, useMemo, useState } from "react";
import type { LocationSummary, AppointmentSummary, ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { buildTrend, dashboardRange, todaysAgenda, topServices, type DashboardRange } from "../lib/dashboardStats.js";
import { tenantDateString } from "../lib/tenantTime.js";
import { AppShell } from "../components/AppShell.js";
import { LocationTabs } from "../components/LocationTabs.js";
import { CreateBookingModal } from "../components/CreateBookingModal.js";
import { DashboardQuickActions, type BookingBlocker } from "../components/DashboardQuickActions.js";
import { TodayAgendaCard } from "../components/TodayAgendaCard.js";
import { BookingTrendChart } from "../components/BookingTrendChart.js";
import { BookingTrendChartSkeleton } from "../components/BookingTrendChartSkeleton.js";
import { TopServicesCard } from "../components/TopServicesCard.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { Alert } from "../components/ui/index.js";
import styles from "./Dashboard.module.css";

const AGENDA_ROW = "58px";
const TABLE_ROW = "34px";

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
  // R150: null = every branch. Every card below derives from `appointments`, so
  // filtering once here is what makes the whole dashboard follow the tab.
  const [locationId, setLocationId] = useState<string | null>(null);

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

  const trend = useMemo(() => {
    if (!visible || !context) return null;
    return buildTrend(visible, context.timezone, context.range);
  }, [visible, context]);

  const top = useMemo(() => (visible ? topServices(visible) : null), [visible]);

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
      <div className={`${styles.grid} fade-up`}>
        {error && <Alert className={styles.errorFull}>{error}</Alert>}

        {context && (
          <div className={styles.locationTabs}>
            <LocationTabs locations={context.locations} selectedId={locationId} onSelect={setLocationId} />
          </div>
        )}

        <div className={styles.actions}>
          <DashboardQuickActions
            role={role}
            onNewBooking={() => setCreateOpen(true)}
            canBook={canBook}
            blocker={blocker}
          />
        </div>

        <div className={styles.agenda}>
          {agenda && context ? (
            <TodayAgendaCard agenda={agenda} timezone={context.timezone} isOwnOnly={role === "professional"} />
          ) : (
            <CardSkeleton rows={4} rowHeight={AGENDA_ROW} />
          )}
        </div>

        <div className={styles.trend}>{trend ? <BookingTrendChart trend={trend} /> : <BookingTrendChartSkeleton />}</div>

        <div className={styles.top}>
          {top ? (
            <TopServicesCard services={top} showValue={role === "owner"} />
          ) : (
            <CardSkeleton rows={5} rowHeight={TABLE_ROW} />
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
          }}
        />
      )}
    </AppShell>
  );
}
