import { useEffect, useMemo, useState } from "react";
import type { AppointmentSummary, ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { buildTrend, dashboardRange, todaysAgenda, topServices, type DashboardRange } from "../lib/dashboardStats.js";
import { tenantDateString } from "../lib/tenantTime.js";
import { AppShell } from "../components/AppShell.js";
import { CreateBookingModal } from "../components/CreateBookingModal.js";
import { DashboardQuickActions, type BookingBlocker } from "../components/DashboardQuickActions.js";
import { TodayAgendaCard } from "../components/TodayAgendaCard.js";
import { BookingTrendChart } from "../components/BookingTrendChart.js";
import { TopServicesCard } from "../components/TopServicesCard.js";
import { Alert, Card } from "../components/ui/index.js";
import styles from "./Dashboard.module.css";

/** Everything fetched once on mount and then held for the life of the page. */
interface PageContext {
  tenantName: string;
  subdomain: string;
  timezone: string;
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
  /** The salon's today — not the staff browser's. */
  today: string;
  range: DashboardRange;
}

/** How often the "next up" highlight re-evaluates against the wall clock. */
const TICK_MS = 60_000;

/**
 * The landing page after sign-in: what's on today, the things staff come here to
 * do, and enough recent history to see how the salon is going.
 *
 * A `professional` login gets the same layout scoped to their own appointments —
 * the API does that scoping (R20) — and no pricing anywhere, which the spec
 * reserves for the owner.
 */
export function DashboardPage() {
  const { t } = useI18n();
  const { role, professionalId } = useAuth();

  const [context, setContext] = useState<PageContext | null>(null);
  const [appointments, setAppointments] = useState<AppointmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Bumped on an interval so a dashboard left open all day stops pointing at an
  // appointment that has already finished. No network involved.
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    Promise.all([cachedApi.getTenant(), cachedApi.listServices(), cachedApi.listProfessionals()])
      .then(([tenant, services, professionals]) => {
        setContext({
          tenantName: tenant.name,
          subdomain: tenant.subdomain,
          timezone: tenant.timezone,
          services,
          professionals,
          today: tenantDateString(tenant.timezone),
          range: dashboardRange(tenant.timezone),
        });
      })
      .catch(() => setError(t("dashboard.errLoad")));
    // Fetch once on mount; a language switch shouldn't trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const range = context?.range;

  function load(from: string, to: string) {
    const { cached, fresh } = cachedApi.listDashboardAppointments({ from, to });
    // Paint the previous payload for this window straight away — returning to
    // the dashboard is the common case, and all three widgets key off
    // `appointments`, so a cold `null` blanks the whole grid at once. A genuine
    // cold read still yields null here, which is the loading state. Either way
    // the request below has already gone out.
    setAppointments(cached);
    fresh.then(setAppointments).catch(() => setError(t("dashboard.errLoad")));
  }

  useEffect(() => {
    if (range) load(range.from, range.to);
    // One request covers the whole page: the API's `to` bound runs to the next
    // tenant-local midnight, so today's remaining appointments arrive in the
    // same payload as the 30-day history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick((n) => n + 1);
      // Once the salon's date rolls over, the window itself has moved: without
      // this, a dashboard left open overnight would keep yesterday's payload and
      // show an empty agenda for the new day. Changing `range` refetches.
      setContext((current) => {
        if (!current) return current;
        const today = tenantDateString(current.timezone);
        if (today === current.today) return current;
        return { ...current, today, range: dashboardRange(current.timezone) };
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // The three widgets memoize separately because only one of them reads the
  // wall clock. Folding them into a single `stats` object made `nowTick` a
  // dependency of all three, so every minute re-walked the full 30-day payload
  // twice over to produce byte-identical trend and top-services results.
  const agenda = useMemo(() => {
    if (!appointments || !context) return null;
    return todaysAgenda(appointments, context.timezone, new Date());
    // nowTick is a deliberate dependency: it's what moves "next up" along.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, context, nowTick]);

  // Pure functions of the payload and the window. A day rollover replaces
  // `context` (and with it `range`), so these still recompute when the window
  // actually moves — just not on the 29 ticks in between.
  const trend = useMemo(() => {
    if (!appointments || !context) return null;
    return buildTrend(appointments, context.timezone, context.range);
  }, [appointments, context]);

  const top = useMemo(() => (appointments ? topServices(appointments) : null), [appointments]);

  const activeServices = context?.services.filter((service) => service.isActive) ?? [];
  const activeProfessionals = context?.professionals.filter((professional) => professional.isActive) ?? [];

  // A professional login with no linked professional can't be pinned to a
  // calendar, so the create form would offer an unlocked picker it shouldn't.
  const canBookAsRole = role !== "professional" || professionalId !== null;
  // One next step, not two: a tenant with neither is pointed at services first.
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

        <div className={styles.actions}>
          <DashboardQuickActions
            role={role}
            onNewBooking={() => setCreateOpen(true)}
            canBook={canBook}
            blocker={blocker}
          />
        </div>

        {/* Each slot holds its place while the payload lands, so the grid doesn't
            jump — and every widget below takes non-nullable data. */}
        <div className={styles.agenda}>
          {agenda && context ? (
            <TodayAgendaCard agenda={agenda} timezone={context.timezone} isOwnOnly={role === "professional"} />
          ) : (
            <Card className={styles.pending}>{t("common.loading")}</Card>
          )}
        </div>

        <div className={styles.trend}>
          {trend ? <BookingTrendChart trend={trend} /> : <Card className={styles.pending}>{t("common.loading")}</Card>}
        </div>

        <div className={styles.top}>
          {top ? (
            <TopServicesCard services={top} showValue={role === "owner"} />
          ) : (
            <Card className={styles.pending}>{t("common.loading")}</Card>
          )}
        </div>
      </div>

      {createOpen && context && (
        <CreateBookingModal
          services={context.services}
          professionals={context.professionals}
          timezone={context.timezone}
          lockedProfessionalId={role === "professional" ? professionalId : null}
          defaultDate={context.today}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            // Refetch rather than navigate: a booking made for next week won't
            // appear in today's agenda, and that's correct — the calendar is
            // where you go to see it.
            load(context.range.from, context.range.to);
          }}
        />
      )}
    </AppShell>
  );
}
