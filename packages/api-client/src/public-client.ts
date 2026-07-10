import type {
  Appointment,
  AvailabilityQuery,
  AvailabilitySlot,
  CreateAppointmentRequest,
  CreateAppointmentResponse,
  ResendMagicLinkRequest,
  RescheduleAppointmentRequest,
  Service,
  Professional,
  Tenant,
} from "@booking/shared-types";
import { HttpClient, type ApiClientOptions } from "./http";

/** Client for apps/public-site — tenant resolved server-side via Host header, no auth. */
export class PublicApiClient {
  private readonly http: HttpClient;

  constructor(options: ApiClientOptions) {
    this.http = new HttpClient(options);
  }

  getTenant() {
    return this.http.get<Tenant>("/public/tenant");
  }

  listServices() {
    return this.http.get<Service[]>("/public/services");
  }

  listProfessionals() {
    return this.http.get<Professional[]>("/public/professionals");
  }

  getAvailability(query: AvailabilityQuery) {
    const params = new URLSearchParams({
      serviceIds: query.serviceIds.join(","),
      date: query.date,
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
    });
    return this.http.get<AvailabilitySlot[]>(`/public/availability?${params.toString()}`);
  }

  createAppointment(payload: CreateAppointmentRequest) {
    return this.http.post<CreateAppointmentResponse>("/public/appointments", payload);
  }

  getAppointmentByToken(token: string) {
    return this.http.get<Appointment>(`/public/manage/${token}`);
  }

  rescheduleAppointment(token: string, payload: RescheduleAppointmentRequest) {
    return this.http.patch<Appointment>(`/public/manage/${token}/reschedule`, payload);
  }

  cancelAppointment(token: string) {
    return this.http.post<Appointment>(`/public/manage/${token}/cancel`);
  }

  resendMagicLink(payload: ResendMagicLinkRequest) {
    return this.http.post<void>("/public/manage/resend", payload);
  }
}
