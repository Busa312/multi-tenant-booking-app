import type {
  AvailabilityQuery,
  CreateAppointmentRequest,
  CreateAppointmentResponse,
  HoldSlotRequest,
  HoldSlotResponse,
  Location,
  ResendMagicLinkRequest,
  RescheduleAppointmentRequest,
  StartVerificationRequest,
  StartVerificationResponse,
  VerifyPhoneRequest,
  VerifyPhoneResponse,
  Service,
  PublicProfessional,
  Tenant,
  Visit,
  VisitSlot,
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

  // R150: `locationId` narrows to that branch's staff plus those at every branch.
  // R240: each carries the services they perform.
  listProfessionals(locationId?: string) {
    const query = locationId ? `?${new URLSearchParams({ locationId }).toString()}` : "";
    return this.http.get<PublicProfessional[]>(`/public/professionals${query}`);
  }

  getAvailability(query: AvailabilityQuery) {
    const params = new URLSearchParams({
      serviceIds: query.serviceIds.join(","),
      date: query.date,
      // R200: aligned with serviceIds, each an id or "any"
      ...(query.professionalIds ? { professionalIds: query.professionalIds.join(",") } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      // R250: so the time this visitor is holding stays on their own list
      ...(query.holdId ? { holdId: query.holdId } : {}),
    });
    return this.http.get<VisitSlot[]>(`/public/availability?${params.toString()}`);
  }

  // R250: hold the time just picked; 409 = someone else got it first
  holdSlot(payload: HoldSlotRequest) {
    return this.http.post<HoldSlotResponse>("/public/holds", payload);
  }

  releaseHold(holdId: string) {
    return this.http.delete<void>(`/public/holds/${encodeURIComponent(holdId)}`);
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
    return this.http.get<Visit>(`/public/manage/${token}`);
  }

  rescheduleAppointment(token: string, payload: RescheduleAppointmentRequest) {
    return this.http.patch<Visit>(`/public/manage/${token}/reschedule`, payload);
  }

  // R80/R230: start times for moving the whole visit, with itself excluded
  getRescheduleAvailability(token: string, date: string) {
    const params = new URLSearchParams({ date });
    return this.http.get<VisitSlot[]>(`/public/manage/${token}/availability?${params.toString()}`);
  }

  cancelAppointment(token: string) {
    return this.http.post<Visit>(`/public/manage/${token}/cancel`);
  }

  resendMagicLink(payload: ResendMagicLinkRequest) {
    return this.http.post<void>("/public/manage/resend", payload);
  }
}
