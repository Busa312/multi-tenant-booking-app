import type {
  AppointmentSummary,
  AvailabilitySlot,
  BusinessHours,
  CmsAppointmentListQuery,
  CmsAvailabilityQuery,
  CmsDashboardQuery,
  CreateCmsAppointmentRequest,
  CreateLocationRequest,
  CreateProfessionalRequest,
  CreateServiceRequest,
  BlockPhoneRequest,
  BlockedPhone,
  CreateTimeOffRequest,
  DashboardSummary,
  InviteProfessionalRequest,
  InviteProfessionalResponse,
  LocationSummary,
  LoginRequest,
  CmsSession,
  ProfessionalSummary,
  UpdateLocationRequest,
  UpdateTenantBookingRulesRequest,
  UpdateTenantCopyRequest,
  UpdateTenantLocalesRequest,
  UpdateCmsAppointmentRequest,
  ServiceSummary,
  SetPasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  Tenant,
  TenantColors,
  TenantConfig,
  TimeOff,
  UnblockPhoneRequest,
  UpcomingAppointmentCountResponse,
  UpdateAppointmentStatusRequest,
  UpdateProfessionalRequest,
  UpdateServiceRequest,
  UpsertBusinessHoursRequest,
  OnboardingStatus,
  UpdateOnboardingRequest,
  CheckoutResponse,
  ConfirmPaymentResponse,
  StartCheckoutRequest,
  SubscriptionOverview,
  UpdateSubscriptionRequest,
  ServiceCategory,
  CreateServiceCategoryRequest,
  UpdateServiceCategoryRequest,
  ReorderServiceCategoriesRequest,
  ReorderServicesRequest
} from "@booking/shared-types";
import { HttpClient, type ApiClientOptions } from "./http";

export class CmsApiClient {
  private readonly http: HttpClient;

  constructor(options: ApiClientOptions) {
    this.http = new HttpClient(options);
  }

  login(payload: LoginRequest) {
    return this.http.post<CmsSession>("/cms/auth/login", payload);
  }

  setPassword(payload: SetPasswordRequest) {
    return this.http.post<CmsSession>("/cms/auth/set-password", payload);
  }

  // R310: resolves the same way whether or not the account exists
  forgotPassword(payload: ForgotPasswordRequest) {
    return this.http.post<void>("/cms/auth/forgot-password", payload);
  }

  resetPassword(payload: ResetPasswordRequest) {
    return this.http.post<CmsSession>("/cms/auth/reset-password", payload);
  }

  // R320: who's signed in — the session cookie itself is unreadable here
  me() {
    return this.http.get<CmsSession>("/cms/auth/me");
  }

  // R320: ends this session on the server and drops the cookie
  logout() {
    return this.http.post<boolean>("/cms/auth/logout");
  }

  getTenant() {
    return this.http.get<Tenant>("/cms/tenant");
  }

  updateTenantConfig(configJson: TenantConfig) {
    return this.http.patch<Tenant>("/cms/tenant/config", { configJson });
  }

  updateTenantColors(colors: TenantColors) {
    return this.http.patch<Tenant>("/cms/tenant/colors", { colors });
  }

  resetTenantColors() {
    return this.http.post<Tenant>("/cms/tenant/colors/reset");
  }

  // R170: the public site's title and description
  updateTenantCopy(payload: UpdateTenantCopyRequest) {
    return this.http.patch<Tenant>("/cms/tenant/copy", payload);
  }

  // R220: owner-only booking rules (the gap allowed between visit segments)
  updateTenantBookingRules(payload: UpdateTenantBookingRulesRequest) {
    return this.http.patch<Tenant>("/cms/tenant/booking-rules", payload);
  }

  // R160: which languages the public site publishes in.
  updateTenantLocales(payload: UpdateTenantLocalesRequest) {
    return this.http.patch<Tenant>("/cms/tenant/locales", payload);
  }

  listLocations() {
    return this.http.get<LocationSummary[]>("/cms/locations");
  }

  createLocation(payload: CreateLocationRequest) {
    return this.http.post<LocationSummary>("/cms/locations", payload);
  }

  updateLocation(id: string, payload: UpdateLocationRequest) {
    return this.http.patch<LocationSummary>(`/cms/locations/${id}`, payload);
  }

  deleteLocation(id: string) {
    return this.http.delete<void>(`/cms/locations/${id}`);
  }

  listServices() {
    return this.http.get<ServiceSummary[]>("/cms/services");
  }

  createService(payload: CreateServiceRequest) {
    return this.http.post<ServiceSummary>("/cms/services", payload);
  }

  updateService(id: string, payload: UpdateServiceRequest) {
    return this.http.patch<ServiceSummary>(`/cms/services/${id}`, payload);
  }

  deleteService(id: string) {
    return this.http.delete<void>(`/cms/services/${id}`);
  }

  // R510: one category's services in their new order — all of them
  reorderServices(payload: ReorderServicesRequest) {
    return this.http.put<ServiceSummary[]>("/cms/services/order", payload);
  }

  // R510: service categories
  listServiceCategories() {
    return this.http.get<ServiceCategory[]>("/cms/service-categories");
  }

  createServiceCategory(payload: CreateServiceCategoryRequest) {
    return this.http.post<ServiceCategory>("/cms/service-categories", payload);
  }

  updateServiceCategory(id: string, payload: UpdateServiceCategoryRequest) {
    return this.http.patch<ServiceCategory>(`/cms/service-categories/${id}`, payload);
  }

  /** Its services stay, uncategorized. */
  deleteServiceCategory(id: string) {
    return this.http.delete<void>(`/cms/service-categories/${id}`);
  }

  reorderServiceCategories(payload: ReorderServiceCategoriesRequest) {
    return this.http.put<ServiceCategory[]>("/cms/service-categories/order", payload);
  }

  listProfessionals() {
    return this.http.get<ProfessionalSummary[]>("/cms/professionals");
  }

  createProfessional(payload: CreateProfessionalRequest) {
    return this.http.post<ProfessionalSummary>("/cms/professionals", payload);
  }

  updateProfessional(id: string, payload: UpdateProfessionalRequest) {
    return this.http.patch<ProfessionalSummary>(`/cms/professionals/${id}`, payload);
  }

  deleteProfessional(id: string) {
    return this.http.delete<void>(`/cms/professionals/${id}`);
  }

  getProfessionalUpcomingCount(id: string) {
    return this.http.get<UpcomingAppointmentCountResponse>(`/cms/professionals/${id}/upcoming-count`);
  }

  inviteProfessional(id: string, payload: InviteProfessionalRequest) {
    return this.http.post<InviteProfessionalResponse>(`/cms/professionals/${id}/invite`, payload);
  }

  listBusinessHours() {
    return this.http.get<BusinessHours[]>("/cms/business-hours");
  }

  upsertBusinessHours(payload: UpsertBusinessHoursRequest) {
    return this.http.post<BusinessHours>("/cms/business-hours", payload);
  }

  deleteBusinessHours(id: string) {
    return this.http.delete<void>(`/cms/business-hours/${id}`);
  }

  listTimeOff() {
    return this.http.get<TimeOff[]>("/cms/time-off");
  }

  createTimeOff(payload: CreateTimeOffRequest) {
    return this.http.post<TimeOff>("/cms/time-off", payload);
  }

  deleteTimeOff(id: string) {
    return this.http.delete<void>(`/cms/time-off/${id}`);
  }

  // R420
  getOnboarding() {
    return this.http.get<OnboardingStatus>("/cms/onboarding");
  }

  updateOnboarding(payload: UpdateOnboardingRequest) {
    return this.http.patch<OnboardingStatus>("/cms/onboarding", payload);
  }

  // R470–R490: the owner's subscription
  getSubscription() {
    return this.http.get<SubscriptionOverview>("/cms/subscription");
  }

  updateSubscription(payload: UpdateSubscriptionRequest) {
    return this.http.patch<SubscriptionOverview>("/cms/subscription", payload);
  }

  /** Flitt's payment page for a month of the plan; the browser goes there next. */
  startCheckout(payload: StartCheckoutRequest & { lang?: "ka" | "en" }) {
    return this.http.post<CheckoutResponse>("/cms/subscription/checkout", payload);
  }

  /** A refunded 1 GEL check on Flitt's page that replaces the saved card. */
  startCardChange(payload: { lang?: "ka" | "en" }) {
    return this.http.post<CheckoutResponse>("/cms/subscription/card", payload);
  }

  /** Back from Flitt's page: the API asks Flitt how the order went. */
  confirmSubscriptionPayment(orderId: string) {
    return this.http.post<ConfirmPaymentResponse>(`/cms/subscription/payments/${encodeURIComponent(orderId)}/confirm`);
  }

  // R380
  listBlockedPhones() {
    return this.http.get<BlockedPhone[]>("/cms/blocked-phones");
  }

  blockPhone(payload: BlockPhoneRequest) {
    return this.http.post<BlockedPhone>("/cms/blocked-phones", payload);
  }

  unblockPhone(payload: UnblockPhoneRequest) {
    return this.http.post<void>("/cms/blocked-phones/unblock", payload);
  }

  listAppointments(query: CmsAppointmentListQuery = {}) {
    const params = new URLSearchParams();
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    const search = params.toString();
    return this.http.get<AppointmentSummary[]>(`/cms/appointments${search ? `?${search}` : ""}`);
  }

  // R370: every number on the home page in one call
  getDashboard(query: CmsDashboardQuery = {}) {
    const params = new URLSearchParams();
    if (query.locationId) params.set("locationId", query.locationId);
    const search = params.toString();
    return this.http.get<DashboardSummary>(`/cms/dashboard${search ? `?${search}` : ""}`);
  }

  // R50: the same open slots the public site would offer for this pairing
  listAppointmentAvailability(query: CmsAvailabilityQuery) {
    const params = new URLSearchParams({ serviceIds: query.serviceIds.join(","), date: query.date });
    if (query.professionalId) params.set("professionalId", query.professionalId);
    if (query.locationId) params.set("locationId", query.locationId);
    if (query.appointmentId) params.set("appointmentId", query.appointmentId);
    return this.http.get<AvailabilitySlot[]>(`/cms/appointments/availability?${params.toString()}`);
  }

  createAppointment(payload: CreateCmsAppointmentRequest) {
    return this.http.post<AppointmentSummary>("/cms/appointments", payload);
  }

  updateAppointment(id: string, payload: UpdateCmsAppointmentRequest) {
    return this.http.patch<AppointmentSummary>(`/cms/appointments/${id}/reschedule`, payload);
  }

  updateAppointmentStatus(id: string, payload: UpdateAppointmentStatusRequest) {
    return this.http.patch<AppointmentSummary>(`/cms/appointments/${id}/status`, payload);
  }

  cancelAppointment(id: string) {
    return this.http.post<AppointmentSummary>(`/cms/appointments/${id}/cancel`);
  }
}
