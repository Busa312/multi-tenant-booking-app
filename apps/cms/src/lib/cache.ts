import type {
  AppointmentSummary,
  CmsAppointmentListQuery,
  CmsAvailabilityQuery,
  CreateCmsAppointmentRequest,
  CreateProfessionalRequest,
  CreateServiceRequest,
  CreateTimeOffRequest,
  InviteProfessionalRequest,
  UpdateCmsAppointmentRequest,
  TenantColors,
  TenantConfig,
  UpdateAppointmentStatusRequest,
  UpdateProfessionalRequest,
  UpdateServiceRequest,
  UpsertBusinessHoursRequest,
} from "@booking/shared-types";
import { cmsApiClient } from "./api.js";

/**
 * In-memory read cache for the CMS's reference data (tenant, services,
 * professionals, hours, time-off) — the five listings almost every page needs
 * but which change only when someone edits them here.
 *
 * Without this, each route change refetches from cold: walking Dashboard ->
 * Bookings -> Services -> Professionals -> Hours issues 13 requests for 6
 * distinct resources, and since every page uses `null` as its loading
 * sentinel, each navigation flashes a full loading state for data fetched
 * seconds earlier. The cost is almost entirely perceived latency, not server
 * load, which is why the fix lives here rather than in Redis.
 *
 * Deliberately NOT a data-fetching library: pages keep the `useState` +
 * `useEffect` + local `load()` pattern the repo standardizes on, and only swap
 * which client they call. This module is a drop-in facade over `cmsApiClient`
 * with the same method names, so a page migrates by changing one import.
 *
 * Appointments are deliberately never cached in the read-through sense — staff
 * act on what the calendar shows, and a booking made by a colleague (or from
 * the public site) must not be invisible here for even a few seconds. Those
 * methods pass straight through, and exist on this facade only so a page never
 * needs both clients. The dashboard gets a stale-while-revalidate variant that
 * preserves the same invariant; see `listDashboardAppointments` below.
 */

type CacheKey = "tenant" | "services" | "professionals" | "business-hours" | "time-off";

/**
 * `CacheKey` plus the appointment ranges, which live in their own map because
 * they are keyed by window rather than by resource. Writes name it like any
 * other key; only `invalidate` knows the difference.
 */
type InvalidationKey = CacheKey | "appointments";

/**
 * Upper bound on how long another staff member's edit can stay invisible.
 * Writes made in *this* tab invalidate precisely (see `mutating` below), so
 * this only ever covers concurrent editors — rare enough in a single salon
 * that a minute is generous, short enough that nobody hard-refreshes.
 */
const TTL_MS = 60_000;

interface Entry<T> {
  value: T;
  at: number;
}

const entries = new Map<CacheKey, Entry<unknown>>();
// Concurrent callers of the same key share one request rather than racing.
// Every page fires its reads through `Promise.all`, so this collapses e.g.
// Services' four parallel calls when two of them are already in flight.
const inFlight = new Map<CacheKey, Promise<unknown>>();

function cached<T>(key: CacheKey, fetcher: () => Promise<T>): Promise<T> {
  const entry = entries.get(key) as Entry<T> | undefined;
  if (entry && Date.now() - entry.at < TTL_MS) {
    return Promise.resolve(entry.value);
  }

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  // A rejection is shared with every awaiting caller and stores nothing, so a
  // failed load leaves the previous entry expired rather than poisoned — the
  // next attempt refetches instead of serving an error forever.
  const request = fetcher()
    .then((value) => {
      entries.set(key, { value, at: Date.now() });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

function invalidate(keys: InvalidationKey[]): void {
  for (const key of keys) {
    if (key === "appointments") {
      // Any appointment write can move a row into or out of any window — a
      // reschedule crosses days by design — so there is nothing finer than
      // dropping every range worth doing here.
      appointmentRanges.clear();
      appointmentInFlight.clear();
      continue;
    }
    entries.delete(key);
    inFlight.delete(key);
  }
}

/**
 * Runs a write, then drops the keys it could have changed — on failure too.
 * A rejected write can still have partially landed (the API updates the
 * ServiceProfessional join and the row itself in one transaction, but a
 * network error after the commit is indistinguishable from one before it), and
 * a needless refetch is far cheaper than showing stale rows.
 */
function mutating<T>(request: Promise<T>, keys: InvalidationKey[]): Promise<T> {
  return request.finally(() => invalidate(keys));
}

// ------------------------------------------- dashboard appointments (SWR)

/**
 * The dashboard renders three widgets — agenda, 30-day trend, top services —
 * off a single `listAppointments` payload, and remounts on every return to
 * `/`. Read-through caching it the way the listings above are cached is not an
 * option: the rule that a colleague's booking is never invisible applies to the
 * agenda as much as to the calendar.
 *
 * So this is stale-while-revalidate rather than read-through. A caller gets the
 * previous payload to paint immediately *and* a live request every time; the
 * cache only ever decides what is on screen during the round trip, never
 * whether one happens. That buys the whole win the read-through cache was
 * built for — no full-grid loading flash on navigation — while leaving the
 * freshness guarantee exactly where it was.
 */
export interface Revalidating<T> {
  /** Available synchronously; null on a cold read, which callers show as loading. */
  cached: T | null;
  /** The network value. Always a real request. */
  fresh: Promise<T>;
}

/**
 * Ranges kept. The window changes only when the salon's date rolls over, so
 * this exists to bound an overnight tab rather than to serve hits — a handful
 * is already more than the page can ask for in a day.
 */
const APPOINTMENT_RANGES = 4;

const appointmentRanges = new Map<string, AppointmentSummary[]>();
const appointmentInFlight = new Map<string, Promise<AppointmentSummary[]>>();

function rememberRange(key: string, value: AppointmentSummary[]): void {
  // Re-insert so Map iteration order is recency, not first-seen: the eviction
  // below takes the front, and a range still in daily use must not age out
  // just because it was the first one fetched.
  appointmentRanges.delete(key);
  appointmentRanges.set(key, value);

  if (appointmentRanges.size > APPOINTMENT_RANGES) {
    const oldest = appointmentRanges.keys().next().value;
    // noUncheckedIndexedAccess: an iterator's `value` is optional even here,
    // where `size` has just been checked.
    if (oldest !== undefined) appointmentRanges.delete(oldest);
  }
}

/**
 * Drops everything. Called on every session boundary (sign-in, sign-out,
 * expiry) from AuthContext — the cache is keyed by resource, not by tenant or
 * user, so a second login in the same tab would otherwise read the previous
 * session's rows. A `professional` login also sees a narrower slice of the
 * same endpoints than an `owner` does (R20), which makes this a correctness
 * requirement rather than just hygiene.
 */
export function clearCmsCache(): void {
  entries.clear();
  inFlight.clear();
  invalidate(["appointments"]);
}

/**
 * `Service.professionalIds` and `Professional.serviceIds` are two views of the
 * same ServiceProfessional join, so a write to either side invalidates both.
 */
const SERVICE_ASSIGNMENT: CacheKey[] = ["services", "professionals"];

/**
 * Deleting a professional cascades to their business hours and time-off rows
 * (schema.prisma: both relations are `onDelete: Cascade`), so those listings
 * go stale too — unlike deactivation, which leaves every row in place.
 */
const PROFESSIONAL_DELETE: CacheKey[] = [...SERVICE_ASSIGNMENT, "business-hours", "time-off"];

export const cachedApi = {
  // ---- Cached reads ----
  getTenant: () => cached("tenant", () => cmsApiClient.getTenant()),
  listServices: () => cached("services", () => cmsApiClient.listServices()),
  listProfessionals: () => cached("professionals", () => cmsApiClient.listProfessionals()),
  listBusinessHours: () => cached("business-hours", () => cmsApiClient.listBusinessHours()),
  listTimeOff: () => cached("time-off", () => cmsApiClient.listTimeOff()),

  // ---- Revalidating read: the dashboard's one payload ----
  /**
   * Returns the previous payload for this window to paint now (null when
   * there isn't one) alongside a request that always goes out. See
   * `Revalidating` for why the dashboard gets this and the calendar doesn't.
   */
  listDashboardAppointments: (range: { from: string; to: string }): Revalidating<AppointmentSummary[]> => {
    const key = `${range.from}:${range.to}`;
    const previous = appointmentRanges.get(key) ?? null;

    // A remount mid-flight rides the request already out rather than issuing a
    // second one — the dashboard's mount effect and its day-rollover refetch
    // can otherwise overlap.
    const pending = appointmentInFlight.get(key);
    if (pending) return { cached: previous, fresh: pending };

    const fresh = cmsApiClient
      .listAppointments({ from: range.from, to: range.to })
      .then((value) => {
        rememberRange(key, value);
        return value;
      })
      .finally(() => {
        appointmentInFlight.delete(key);
      });

    appointmentInFlight.set(key, fresh);
    return { cached: previous, fresh };
  },

  // ---- Writes: delegate, then drop what they changed ----
  updateTenantConfig: (configJson: TenantConfig) => mutating(cmsApiClient.updateTenantConfig(configJson), ["tenant"]),
  updateTenantColors: (colors: TenantColors) => mutating(cmsApiClient.updateTenantColors(colors), ["tenant"]),
  resetTenantColors: () => mutating(cmsApiClient.resetTenantColors(), ["tenant"]),

  createService: (payload: CreateServiceRequest) => mutating(cmsApiClient.createService(payload), SERVICE_ASSIGNMENT),
  updateService: (id: string, payload: UpdateServiceRequest) =>
    mutating(cmsApiClient.updateService(id, payload), SERVICE_ASSIGNMENT),
  deleteService: (id: string) => mutating(cmsApiClient.deleteService(id), SERVICE_ASSIGNMENT),

  createProfessional: (payload: CreateProfessionalRequest) =>
    mutating(cmsApiClient.createProfessional(payload), SERVICE_ASSIGNMENT),
  updateProfessional: (id: string, payload: UpdateProfessionalRequest) =>
    mutating(cmsApiClient.updateProfessional(id, payload), SERVICE_ASSIGNMENT),
  deleteProfessional: (id: string) => mutating(cmsApiClient.deleteProfessional(id), PROFESSIONAL_DELETE),
  // Issuing an invite flips `ProfessionalSummary.cmsLoginStatus`, which the
  // listing renders — so this is a write to the professionals listing too.
  inviteProfessional: (id: string, payload: InviteProfessionalRequest) =>
    mutating(cmsApiClient.inviteProfessional(id, payload), ["professionals"]),

  upsertBusinessHours: (payload: UpsertBusinessHoursRequest) =>
    mutating(cmsApiClient.upsertBusinessHours(payload), ["business-hours"]),
  deleteBusinessHours: (id: string) => mutating(cmsApiClient.deleteBusinessHours(id), ["business-hours"]),

  createTimeOff: (payload: CreateTimeOffRequest) => mutating(cmsApiClient.createTimeOff(payload), ["time-off"]),
  deleteTimeOff: (id: string) => mutating(cmsApiClient.deleteTimeOff(id), ["time-off"]),

  // Every appointment write drops the dashboard's cached ranges: a booking
  // cancelled from the calendar must not be repainted as still booked when
  // staff step back to the dashboard, even for the one round trip that
  // stale-while-revalidate would take to correct it.
  //
  // Booking a service/professional for the first time additionally flips their
  // `hasAppointmentHistory`, which is what hides the delete action in favour of
  // deactivate (R70/R80) — so these two writes invalidate the listings as well.
  // A reschedule counts because it can reassign `professionalId`. Cancelling
  // and status changes do not: the API derives the flag from
  // `_count.appointments`, which is unfiltered by status, so the row keeps
  // counting once it exists.
  createAppointment: (payload: CreateCmsAppointmentRequest) =>
    mutating(cmsApiClient.createAppointment(payload), [...SERVICE_ASSIGNMENT, "appointments"]),
  updateAppointment: (id: string, payload: UpdateCmsAppointmentRequest) =>
    mutating(cmsApiClient.updateAppointment(id, payload), [...SERVICE_ASSIGNMENT, "appointments"]),
  updateAppointmentStatus: (id: string, payload: UpdateAppointmentStatusRequest) =>
    mutating(cmsApiClient.updateAppointmentStatus(id, payload), ["appointments"]),
  cancelAppointment: (id: string) => mutating(cmsApiClient.cancelAppointment(id), ["appointments"]),

  // ---- Uncached passthroughs ----
  // Point-in-time counts and the calendar's own reads: always the network, with
  // nothing to paint in the meantime. Staff act on what the calendar shows, and
  // a booking made by a colleague or from the public site must not be invisible
  // here even briefly.
  getProfessionalUpcomingCount: (id: string) => cmsApiClient.getProfessionalUpcomingCount(id),
  listAppointments: (query: CmsAppointmentListQuery = {}) => cmsApiClient.listAppointments(query),
  listAppointmentAvailability: (query: CmsAvailabilityQuery) => cmsApiClient.listAppointmentAvailability(query),
};
