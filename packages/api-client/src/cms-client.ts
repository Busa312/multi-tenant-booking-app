import type {
  Appointment,
  BusinessHours,
  CreateProfessionalRequest,
  CreateServiceRequest,
  CreateTimeOffRequest,
  LoginRequest,
  LoginResponse,
  Professional,
  Service,
  Tenant,
  TenantColors,
  TenantConfig,
  TimeOff,
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
    return this.http.get<Service[]>("/cms/services");
  }

  createService(payload: CreateServiceRequest) {
    return this.http.post<Service>("/cms/services", payload);
  }

  updateService(id: string, payload: Partial<CreateServiceRequest>) {
    return this.http.patch<Service>(`/cms/services/${id}`, payload);
  }

  deleteService(id: string) {
    return this.http.delete<void>(`/cms/services/${id}`);
  }

  listProfessionals() {
    return this.http.get<Professional[]>("/cms/professionals");
  }

  createProfessional(payload: CreateProfessionalRequest) {
    return this.http.post<Professional>("/cms/professionals", payload);
  }

  listBusinessHours() {
    return this.http.get<BusinessHours[]>("/cms/business-hours");
  }

  upsertBusinessHours(payload: UpsertBusinessHoursRequest) {
    return this.http.post<BusinessHours>("/cms/business-hours", payload);
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

  listAppointments() {
    return this.http.get<Appointment[]>("/cms/appointments");
  }

  cancelAppointment(id: string) {
    return this.http.post<Appointment>(`/cms/appointments/${id}/cancel`);
  }

  rescheduleAppointment(id: string, startAt: string) {
    return this.http.patch<Appointment>(`/cms/appointments/${id}/reschedule`, { startAt });
  }
}
