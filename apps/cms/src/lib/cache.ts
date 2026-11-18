import type {
  AppointmentSummary,
  CmsAppointmentListQuery,
  CmsDashboardQuery,
  CmsAvailabilityQuery,
  CreateCmsAppointmentRequest,
  CreateLocationRequest,
  CreateProfessionalRequest,
  CreateServiceRequest,
  BlockPhoneRequest,
  CreateTimeOffRequest,
  InviteProfessionalRequest,
  UpdateCmsAppointmentRequest,
  TenantColors,
  TenantConfig,
  UnblockPhoneRequest,
  UpdateAppointmentStatusRequest,
  UpdateLocationRequest,
  UpdateProfessionalRequest,
  UpdateServiceRequest,
  UpdateTenantBookingRulesRequest,
  UpdateTenantCopyRequest,
  UpdateTenantLocalesRequest,
  UpsertBusinessHoursRequest,
  Tenant,
  OnboardingStatus,
  UpdateOnboardingRequest,
  SubscriptionOverview,
  SubscriptionPlanId,
  UpdateSubscriptionRequest,
  CreateServiceCategoryRequest,
  UpdateServiceCategoryRequest,
  ReorderServiceCategoriesRequest,
  ReorderServicesRequest
} from "@booking/shared-types";
import { cmsApiClient } from "./api.js";

type CacheKey =
  | "tenant"
  | "services"
  | "service-categories"
  | "professionals"
  | "business-hours"
  | "time-off"
  | "locations"
  | "onboarding"
  | "subscription";

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

// R420: whoever shows the setup's state (the sidebar) hears of every change to
// it at once — finishing or hiding the setup takes its menu entry away while
// the page that did it is still on screen.
const onboardingListeners = new Set<(status: OnboardingStatus) => void>();

function rememberOnboarding(status: OnboardingStatus): OnboardingStatus {
  entries.set("onboarding", { value: status, at: Date.now() });
  onboardingListeners.forEach((listener) => listener(status));
  return status;
}

// R480: the subscription banner hears of every change at once — paying on the
// subscription page takes the "trial ending" warning away there and then.
const subscriptionListeners = new Set<(overview: SubscriptionOverview) => void>();

function rememberSubscription(overview: SubscriptionOverview): SubscriptionOverview {
  entries.set("subscription", { value: overview, at: Date.now() });
  subscriptionListeners.forEach((listener) => listener(overview));
  return overview;
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
  /** Whatever tenant is cached, however old — for a first render that can't wait. */
  peekTenant: (): Tenant | undefined => (entries.get("tenant") as Entry<Tenant> | undefined)?.value,
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
  // R220
  updateTenantBookingRules: (payload: UpdateTenantBookingRulesRequest) =>
    mutating(cmsApiClient.updateTenantBookingRules(payload), ["tenant"]),
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
  // R510: categories and the salon's order. Deleting a category moves its services.
  reorderServices: (payload: ReorderServicesRequest) => mutating(cmsApiClient.reorderServices(payload), ["services"]),
  listServiceCategories: () => cached("service-categories", () => cmsApiClient.listServiceCategories()),
  createServiceCategory: (payload: CreateServiceCategoryRequest) =>
    mutating(cmsApiClient.createServiceCategory(payload), ["service-categories"]),
  updateServiceCategory: (id: string, payload: UpdateServiceCategoryRequest) =>
    mutating(cmsApiClient.updateServiceCategory(id, payload), ["service-categories"]),
  deleteServiceCategory: (id: string) => mutating(cmsApiClient.deleteServiceCategory(id), ["service-categories", "services"]),
  reorderServiceCategories: (payload: ReorderServiceCategoriesRequest) =>
    mutating(cmsApiClient.reorderServiceCategories(payload), ["service-categories"]),
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
  // R420: always fetched fresh — it is read from the salon's data, which every
  // other write changes. Each answer is remembered for the sidebar, which only
  // needs to know whether the setup is still open.
  getOnboarding: () => {
    // Fresh, but shared: the sidebar asks at the same moment as the page.
    if (!inFlight.has("onboarding")) entries.delete("onboarding");
    return cached("onboarding", () => cmsApiClient.getOnboarding()).then(rememberOnboarding);
  },
  updateOnboarding: (payload: UpdateOnboardingRequest) => cmsApiClient.updateOnboarding(payload).then(rememberOnboarding),
  /** The setup's state as last seen, fetched only when nothing recent is known. */
  getOnboardingCached: () => cached("onboarding", () => cmsApiClient.getOnboarding()),
  peekOnboarding: (): OnboardingStatus | undefined =>
    (entries.get("onboarding") as Entry<OnboardingStatus> | undefined)?.value,
  /** Calls `listener` with every new setup state; returns the way to stop. */
  onOnboardingChange: (listener: (status: OnboardingStatus) => void): (() => void) => {
    onboardingListeners.add(listener);
    return () => onboardingListeners.delete(listener);
  },
  // R470: fetched fresh by the subscription page; each answer is remembered for the banner.
  getSubscription: () => {
    if (!inFlight.has("subscription")) entries.delete("subscription");
    return cached("subscription", () => cmsApiClient.getSubscription()).then(rememberSubscription);
  },
  /** As last seen, fetched only when nothing recent is known (the banner on every page). */
  getSubscriptionCached: () => cached("subscription", () => cmsApiClient.getSubscription()),
  onSubscriptionChange: (listener: (overview: SubscriptionOverview) => void): (() => void) => {
    subscriptionListeners.add(listener);
    return () => subscriptionListeners.delete(listener);
  },
  updateSubscription: (payload: UpdateSubscriptionRequest) =>
    cmsApiClient.updateSubscription(payload).then(rememberSubscription),
  confirmSubscriptionPayment: (orderId: string) =>
    cmsApiClient.confirmSubscriptionPayment(orderId).then((result) => {
      rememberSubscription(result.subscription);
      return result;
    }),
  startCheckout: (planId: SubscriptionPlanId, lang: "ka" | "en") => cmsApiClient.startCheckout({ planId, lang }),
  startCardChange: (lang: "ka" | "en") => cmsApiClient.startCardChange({ lang }),
  // R380: never cached — a short list, and a block must show the moment it's made.
  // Blocking changes what every listed appointment says about its customer.
  listBlockedPhones: () => cmsApiClient.listBlockedPhones(),
  blockPhone: (payload: BlockPhoneRequest) => mutating(cmsApiClient.blockPhone(payload), ["appointments"]),
  unblockPhone: (payload: UnblockPhoneRequest) => mutating(cmsApiClient.unblockPhone(payload), ["appointments"]),
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
  // R370: never cached — it's the page's live numbers, and cheap to recompute
  getDashboard: (query: CmsDashboardQuery = {}) => cmsApiClient.getDashboard(query),
  listAppointmentAvailability: (query: CmsAvailabilityQuery) => cmsApiClient.listAppointmentAvailability(query),
};
