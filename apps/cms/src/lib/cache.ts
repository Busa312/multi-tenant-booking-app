import type {
  AppointmentSummary,
  CmsAppointmentListQuery,
  CmsAvailabilityQuery,
  CreateCmsAppointmentRequest,
  CreateLocationRequest,
  CreateProfessionalRequest,
  CreateServiceRequest,
  CreateTimeOffRequest,
  InviteProfessionalRequest,
  UpdateCmsAppointmentRequest,
  TenantColors,
  TenantConfig,
  UpdateAppointmentStatusRequest,
  UpdateLocationRequest,
  UpdateProfessionalRequest,
  UpdateServiceRequest,
  UpdateTenantCopyRequest,
  UpdateTenantLocalesRequest,
  UpsertBusinessHoursRequest,
} from "@booking/shared-types";
import { cmsApiClient } from "./api.js";

type CacheKey = "tenant" | "services" | "professionals" | "business-hours" | "time-off" | "locations";

type InvalidationKey = CacheKey | "appointments";

const TTL_MS = 60_000;

interface Entry<T> {
  value: T;
  at: number;
}

const entries = new Map<CacheKey, Entry<unknown>>();

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
      appointmentRanges.clear();
      appointmentInFlight.clear();
      continue;
    }
    entries.delete(key);
    inFlight.delete(key);
  }
}

function mutating<T>(request: Promise<T>, keys: InvalidationKey[]): Promise<T> {
  return request.finally(() => invalidate(keys));
}

export interface Revalidating<T> {
  cached: T | null;

  fresh: Promise<T>;
}

const APPOINTMENT_RANGES = 4;

const appointmentRanges = new Map<string, AppointmentSummary[]>();
const appointmentInFlight = new Map<string, Promise<AppointmentSummary[]>>();

function rememberRange(key: string, value: AppointmentSummary[]): void {
  appointmentRanges.delete(key);
  appointmentRanges.set(key, value);

  if (appointmentRanges.size > APPOINTMENT_RANGES) {
    const oldest = appointmentRanges.keys().next().value;

    if (oldest !== undefined) appointmentRanges.delete(oldest);
  }
}

export function clearCmsCache(): void {
  entries.clear();
  inFlight.clear();
  invalidate(["appointments"]);
}

const SERVICE_ASSIGNMENT: CacheKey[] = ["services", "professionals"];

const PROFESSIONAL_DELETE: CacheKey[] = [...SERVICE_ASSIGNMENT, "business-hours", "time-off"];

// Booking anything gives its service, professional and branch appointment
// history, which is what `hasAppointmentHistory` reports and what decides
// whether the listings offer Delete or only Deactivate. Leaving these stale
// keeps offering a Delete the API answers 409 to.
const APPOINTMENT_WRITE: CacheKey[] = [...SERVICE_ASSIGNMENT, "locations"];

const LOCATION_KEYS: CacheKey[] = ["locations", "professionals"];

export const cachedApi = {
  getTenant: () => cached("tenant", () => cmsApiClient.getTenant()),
  listServices: () => cached("services", () => cmsApiClient.listServices()),
  listLocations: () => cached("locations", () => cmsApiClient.listLocations()),
  listProfessionals: () => cached("professionals", () => cmsApiClient.listProfessionals()),
  listBusinessHours: () => cached("business-hours", () => cmsApiClient.listBusinessHours()),
  listTimeOff: () => cached("time-off", () => cmsApiClient.listTimeOff()),
  listDashboardAppointments: (range: { from: string; to: string }): Revalidating<AppointmentSummary[]> => {
    const key = `${range.from}:${range.to}`;
    const previous = appointmentRanges.get(key) ?? null;

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
  updateTenantConfig: (configJson: TenantConfig) => mutating(cmsApiClient.updateTenantConfig(configJson), ["tenant"]),
  updateTenantColors: (colors: TenantColors) => mutating(cmsApiClient.updateTenantColors(colors), ["tenant"]),
  resetTenantColors: () => mutating(cmsApiClient.resetTenantColors(), ["tenant"]),
  updateTenantCopy: (payload: UpdateTenantCopyRequest) => mutating(cmsApiClient.updateTenantCopy(payload), ["tenant"]),
  // Turning a language on or off changes which tabs every editor shows, so the
  // listings that render LocalizedField go stale alongside the tenant itself.
  updateTenantLocales: (payload: UpdateTenantLocalesRequest) =>
    mutating(cmsApiClient.updateTenantLocales(payload), ["tenant", "services", "professionals", "locations"]),

  // R180: a branch edit moves which staff are bookable where

  createLocation: (payload: CreateLocationRequest) => mutating(cmsApiClient.createLocation(payload), LOCATION_KEYS),
  updateLocation: (id: string, payload: UpdateLocationRequest) =>
    mutating(cmsApiClient.updateLocation(id, payload), LOCATION_KEYS),
  deleteLocation: (id: string) => mutating(cmsApiClient.deleteLocation(id), LOCATION_KEYS),
  createService: (payload: CreateServiceRequest) => mutating(cmsApiClient.createService(payload), SERVICE_ASSIGNMENT),
  updateService: (id: string, payload: UpdateServiceRequest) =>
    mutating(cmsApiClient.updateService(id, payload), SERVICE_ASSIGNMENT),
  deleteService: (id: string) => mutating(cmsApiClient.deleteService(id), SERVICE_ASSIGNMENT),
  createProfessional: (payload: CreateProfessionalRequest) =>
    mutating(cmsApiClient.createProfessional(payload), SERVICE_ASSIGNMENT),
  updateProfessional: (id: string, payload: UpdateProfessionalRequest) =>
    mutating(cmsApiClient.updateProfessional(id, payload), SERVICE_ASSIGNMENT),
  deleteProfessional: (id: string) => mutating(cmsApiClient.deleteProfessional(id), PROFESSIONAL_DELETE),
  inviteProfessional: (id: string, payload: InviteProfessionalRequest) =>
    mutating(cmsApiClient.inviteProfessional(id, payload), ["professionals"]),
  upsertBusinessHours: (payload: UpsertBusinessHoursRequest) =>
    mutating(cmsApiClient.upsertBusinessHours(payload), ["business-hours"]),
  deleteBusinessHours: (id: string) => mutating(cmsApiClient.deleteBusinessHours(id), ["business-hours"]),
  createTimeOff: (payload: CreateTimeOffRequest) => mutating(cmsApiClient.createTimeOff(payload), ["time-off"]),
  deleteTimeOff: (id: string) => mutating(cmsApiClient.deleteTimeOff(id), ["time-off"]),
  createAppointment: (payload: CreateCmsAppointmentRequest) =>
    mutating(cmsApiClient.createAppointment(payload), [...APPOINTMENT_WRITE, "appointments"]),
  updateAppointment: (id: string, payload: UpdateCmsAppointmentRequest) =>
    mutating(cmsApiClient.updateAppointment(id, payload), [...APPOINTMENT_WRITE, "appointments"]),
  updateAppointmentStatus: (id: string, payload: UpdateAppointmentStatusRequest) =>
    mutating(cmsApiClient.updateAppointmentStatus(id, payload), ["appointments"]),
  cancelAppointment: (id: string) => mutating(cmsApiClient.cancelAppointment(id), ["appointments"]),
  getProfessionalUpcomingCount: (id: string) => cmsApiClient.getProfessionalUpcomingCount(id),
  listAppointments: (query: CmsAppointmentListQuery = {}) => cmsApiClient.listAppointments(query),
  listAppointmentAvailability: (query: CmsAvailabilityQuery) => cmsApiClient.listAppointmentAvailability(query),
};
