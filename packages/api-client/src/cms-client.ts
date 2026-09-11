import type {
  AppointmentSummary,
  AvailabilitySlot,
  BusinessHours,
  CmsAppointmentListQuery,
  CmsAvailabilityQuery,
  CreateCmsAppointmentRequest,
  CreateLocationRequest,
  CreateProfessionalRequest,
  CreateServiceRequest,
  CreateTimeOffRequest,
  InviteProfessionalRequest,
  InviteProfessionalResponse,
  LocationSummary,
  LoginRequest,
  LoginResponse,
  ProfessionalSummary,
  UpdateLocationRequest,
  UpdateTenantCopyRequest,
  UpdateTenantLocalesRequest,
  UpdateCmsAppointmentRequest,
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

  // R170: the public site's title and description
  updateTenantCopy(payload: UpdateTenantCopyRequest) {
    return this.http.patch<Tenant>("/cms/tenant/copy", payload);
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

  listAppointments(query: CmsAppointmentListQuery = {}) {
    const params = new URLSearchParams();
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    const search = params.toString();
    return this.http.get<AppointmentSummary[]>(`/cms/appointments${search ? `?${search}` : ""}`);
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
