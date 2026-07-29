import type {
  AppointmentSummary,
  AvailabilitySlot,
  BusinessHours,
  CmsAppointmentListQuery,
  CmsAvailabilityQuery,
  CreateCmsAppointmentRequest,
  CreateProfessionalRequest,
  CreateServiceRequest,
  CreateTimeOffRequest,
  InviteProfessionalRequest,
  InviteProfessionalResponse,
  LoginRequest,
  LoginResponse,
  ProfessionalSummary,
  RescheduleCmsAppointmentRequest,
  ServiceSummary,
  SetPasswordRequest,
  Tenant,
  TenantColors,
  TenantConfig,
  TimeOff,
  UpcomingAppointmentCountResponse,
  UpdateAppointmentStatusRequest,
  UpdateProfessionalRequest,
  UpdateServiceRequest,
  UpsertBusinessHoursRequest,
} from "@booking/shared-types";
import { HttpClient, type ApiClientOptions } from "./http";

/** Client for apps/cms — every call after login carries the JWT via ApiClientOptions.getAuthToken. */
export class CmsApiClient {
  private readonly http: HttpClient;

  constructor(options: ApiClientOptions) {
    this.http = new HttpClient(options);
  }

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>("/cms/auth/login", payload);
  }

  setPassword(payload: SetPasswordRequest) {
    return this.http.post<LoginResponse>("/cms/auth/set-password", payload);
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

  /** Both dates are tenant-local YYYY-MM-DD days, inclusive. */
  listAppointments(query: CmsAppointmentListQuery = {}) {
    const params = new URLSearchParams();
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    const search = params.toString();
    return this.http.get<AppointmentSummary[]>(`/cms/appointments${search ? `?${search}` : ""}`);
  }

  /** R50: the same open slots the public site would offer for this pairing. */
  listAppointmentAvailability(query: CmsAvailabilityQuery) {
    const params = new URLSearchParams({ serviceId: query.serviceId, date: query.date });
    if (query.professionalId) params.set("professionalId", query.professionalId);
    return this.http.get<AvailabilitySlot[]>(`/cms/appointments/availability?${params.toString()}`);
  }

  /**
   * Answers 409 with a BookingConflictResponse body when the chosen time
   * collides with anything and `override` isn't set (R60) — the caller shows the
   * named conflicts and retries with `override: true` if staff confirms.
   */
  createAppointment(payload: CreateCmsAppointmentRequest) {
    return this.http.post<AppointmentSummary>("/cms/appointments", payload);
  }

  /** Same 409-then-override contract as createAppointment. */
  rescheduleAppointment(id: string, payload: RescheduleCmsAppointmentRequest) {
    return this.http.patch<AppointmentSummary>(`/cms/appointments/${id}/reschedule`, payload);
  }

  updateAppointmentStatus(id: string, payload: UpdateAppointmentStatusRequest) {
    return this.http.patch<AppointmentSummary>(`/cms/appointments/${id}/status`, payload);
  }

  cancelAppointment(id: string) {
    return this.http.post<AppointmentSummary>(`/cms/appointments/${id}/cancel`);
  }
}
