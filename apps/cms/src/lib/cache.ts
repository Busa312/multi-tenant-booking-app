import type {
  CmsAppointmentListQuery,
  CmsAvailabilityQuery,
  CreateCmsAppointmentRequest,
  CreateProfessionalRequest,
  CreateServiceRequest,
  CreateTimeOffRequest,
  InviteProfessionalRequest,
  RescheduleCmsAppointmentRequest,
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
 * Appointments are deliberately never cached — staff act on what the calendar
 * shows, and a booking made by a colleague (or from the public site) must not
 * be invisible here for even a few seconds. Those methods pass straight
 * through, and exist on this facade only so a page never needs both clients.
 */

type CacheKey = "tenant" | "services" | "professionals" | "business-hours" | "time-off";

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

function invalidate(keys: CacheKey[]): void {
  for (const key of keys) {
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
function mutating<T>(request: Promise<T>, keys: CacheKey[]): Promise<T> {
  return request.finally(() => invalidate(keys));
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

  // Booking a service/professional for the first time flips their
  // `hasAppointmentHistory`, which is what hides the delete action in favour of
  // deactivate (R70/R80) — so these two writes invalidate the listings even
  // though the appointments themselves are never cached. A reschedule counts
  // because it can reassign `professionalId`. Cancelling and status changes do
  // not: the API derives the flag from `_count.appointments`, which is
  // unfiltered by status, so the row keeps counting once it exists.
  createAppointment: (payload: CreateCmsAppointmentRequest) =>
    mutating(cmsApiClient.createAppointment(payload), SERVICE_ASSIGNMENT),
  rescheduleAppointment: (id: string, payload: RescheduleCmsAppointmentRequest) =>
    mutating(cmsApiClient.rescheduleAppointment(id, payload), SERVICE_ASSIGNMENT),

  // ---- Uncached passthroughs ----
  // Point-in-time counts and the rest of the appointment surface: always the
  // network. Staff act on what the calendar shows, and a booking made by a
  // colleague or from the public site must not be invisible here even briefly.
  getProfessionalUpcomingCount: (id: string) => cmsApiClient.getProfessionalUpcomingCount(id),
  listAppointments: (query: CmsAppointmentListQuery = {}) => cmsApiClient.listAppointments(query),
  listAppointmentAvailability: (query: CmsAvailabilityQuery) => cmsApiClient.listAppointmentAvailability(query),
  updateAppointmentStatus: (id: string, payload: UpdateAppointmentStatusRequest) =>
    cmsApiClient.updateAppointmentStatus(id, payload),
  cancelAppointment: (id: string) => cmsApiClient.cancelAppointment(id),
};
