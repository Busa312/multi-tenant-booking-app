import type {
  Appointment,
  AvailabilityQuery,
  AvailabilitySlot,
  CreateAppointmentRequest,
  CreateAppointmentResponse,
  Location,
  ResendMagicLinkRequest,
  RescheduleAppointmentRequest,
  RescheduleAppointmentResponse,
  StartVerificationRequest,
  StartVerificationResponse,
  VerifyPhoneRequest,
  VerifyPhoneResponse,
  Service,
  Professional,
  Tenant,
} from "@booking/shared-types";
import { HttpClient, type ApiClientOptions } from "./http";

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

  // R150: active branches
  listLocations() {
    return this.http.get<Location[]>("/public/locations");
  }

  // R150: `locationId` narrows to that branch's staff plus those at every branch
  listProfessionals(locationId?: string) {
    const query = locationId ? `?${new URLSearchParams({ locationId }).toString()}` : "";
    return this.http.get<Professional[]>(`/public/professionals${query}`);
  }

  getAvailability(query: AvailabilityQuery) {
    const params = new URLSearchParams({
      serviceIds: query.serviceIds.join(","),
      date: query.date,
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
    });
    return this.http.get<AvailabilitySlot[]>(`/public/availability?${params.toString()}`);
  }

  startVerification(payload: StartVerificationRequest) {
    return this.http.post<StartVerificationResponse>("/public/verification/start", payload);
  }

  verifyPhone(payload: VerifyPhoneRequest) {
    return this.http.post<VerifyPhoneResponse>("/public/verification/verify", payload);
  }

  createAppointment(payload: CreateAppointmentRequest) {
    return this.http.post<CreateAppointmentResponse>("/public/appointments", payload);
  }

  getAppointmentByToken(token: string) {
    return this.http.get<Appointment>(`/public/manage/${token}`);
  }

  rescheduleAppointment(token: string, payload: RescheduleAppointmentRequest) {
    return this.http.patch<RescheduleAppointmentResponse>(`/public/manage/${token}/reschedule`, payload);
  }

  // R80: slots for re-timing this appointment, with itself excluded
  getRescheduleAvailability(token: string, date: string) {
    const params = new URLSearchParams({ date });
    return this.http.get<AvailabilitySlot[]>(`/public/manage/${token}/availability?${params.toString()}`);
  }

  cancelAppointment(token: string) {
    return this.http.post<Appointment>(`/public/manage/${token}/cancel`);
  }

  resendMagicLink(payload: ResendMagicLinkRequest) {
    return this.http.post<void>("/public/manage/resend", payload);
  }
}
