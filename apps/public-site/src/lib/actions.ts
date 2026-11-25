"use server";

import { ApiError } from "@booking/api-client";
import type { OtpCooldownResponse, PublicProfessional, Visit, VisitPlace, VisitSlot } from "@booking/shared-types";
import { getPublicApiClient } from "./api";

export type ActionResult<T> = ({ ok: true } & T) | { ok: false; reason: FailureReason };

// tooLate (R300): inside the salon's cutoff — changes go through the salon now
// "blocked" (R380): this salon doesn't take online bookings from the number
// "paused" (R490): the salon's subscription has lapsed — no online bookings at all
export type FailureReason = "conflict" | "invalid" | "notFound" | "limit" | "tooLate" | "blocked" | "paused" | "unknown";

function toFailure(error: unknown): { ok: false; reason: FailureReason } {
  if (error instanceof ApiError) {
    if (error.status === 409) return { ok: false, reason: "conflict" };
    if (error.status === 429) return { ok: false, reason: "limit" };
    const code = (error.body as { code?: unknown } | null)?.code;
    if (error.status === 403 && code === "phone_blocked") {
      return { ok: false, reason: "blocked" };
    }
    if (error.status === 403 && code === "booking_paused") {
      return { ok: false, reason: "paused" };
    }
    if (error.status === 403) return { ok: false, reason: "tooLate" };
    if (error.status === 404) return { ok: false, reason: "notFound" };
    if (error.status === 400) return { ok: false, reason: "invalid" };
  }
  return { ok: false, reason: "unknown" };
}

export interface AvailabilityRequest {
  serviceIds: string[];
  // R200: aligned with serviceIds; null = any qualified professional
  professionalIds: (string | null)[];
  locationId?: string;

  date: string;
  // R250: the visitor's own hold, so the time they're holding stays listed
  holdId?: string;
  // R630: a home visit's times keep travel free around them
  place?: VisitPlace;
}

export async function fetchAvailability(
  request: AvailabilityRequest,
): Promise<ActionResult<{ slots: VisitSlot[] }>> {
  try {
    const slots = await getPublicApiClient().getAvailability({
      ...request,
      professionalIds: request.professionalIds.map((id) => id ?? "any"),
    });
    return { ok: true, slots };
  } catch (error) {
    return toFailure(error);
  }
}

// R180: the staff bookable at one branch
export async function fetchProfessionals(
  locationId?: string,
): Promise<ActionResult<{ professionals: PublicProfessional[] }>> {
  try {
    const professionals = await getPublicApiClient().listProfessionals(locationId);
    return { ok: true, professionals };
  } catch (error) {
    return toFailure(error);
  }
}

/** A code went to this number under a minute ago; it still works. */
export interface VerificationCooldown {
  ok: false;
  reason: "cooldown";
  retryAfterSeconds: number;
}

const isOtpCooldown = (body: unknown): body is OtpCooldownResponse =>
  typeof body === "object" && body !== null && (body as { code?: unknown }).code === "otp_cooldown";

export async function startVerification(
  phoneNumber: string,
): Promise<ActionResult<{ expiresAt: string; devCode: string | null }> | VerificationCooldown> {
  try {
    const response = await getPublicApiClient().startVerification({ phoneNumber });
    return { ok: true, ...response };
  } catch (error) {
    if (error instanceof ApiError && error.status === 429 && isOtpCooldown(error.body)) {
      return { ok: false, reason: "cooldown", retryAfterSeconds: error.body.retryAfterSeconds };
    }
    return toFailure(error);
  }
}

export async function verifyPhone(
  phoneNumber: string,
  code: string,
): Promise<ActionResult<{ verificationToken: string }>> {
  try {
    const response = await getPublicApiClient().verifyPhone({ phoneNumber, code });
    return { ok: true, ...response };
  } catch (error) {
    return toFailure(error);
  }
}

export interface BookingRequest {
  serviceIds: string[];
  // R200: one per service — taken from the chosen slot's plan, so the visit
  // booked is exactly the one the customer was shown
  professionalIds: string[];
  locationId?: string;
  date: string;
  time: string;
  userName: string;
  phoneNumber: string;
  verificationToken: string;
  // R250: the hold taken when the time was picked, used up by the booking
  holdId?: string;
  // R630: where, and the address for a visit at the customer's
  place?: VisitPlace;
  customerAddress?: string;
  customerAddressDetails?: string;
  customerAddressNote?: string;
}

export interface HoldRequest {
  serviceIds: string[];
  professionalIds: string[];
  locationId?: string;
  date: string;
  time: string;
  replaceHoldId?: string;
  // R630
  place?: VisitPlace;
}

/**
 * R250: holds the picked time while the customer finishes. "conflict" means
 * someone else got it first; "limit" means no hold this time — the customer can
 * still book, and the booking re-checks.
 */
export async function holdSlot(
  request: HoldRequest,
): Promise<ActionResult<{ holdId: string; expiresAt: string; slot: VisitSlot }>> {
  try {
    const response = await getPublicApiClient().holdSlot(request);
    return { ok: true, ...response };
  } catch (error) {
    return toFailure(error);
  }
}

// R250: best effort — an unreleased hold simply expires
export async function releaseHold(holdId: string): Promise<{ ok: true }> {
  await getPublicApiClient()
    .releaseHold(holdId)
    .catch(() => undefined);
  return { ok: true };
}

export async function submitBooking(
  request: BookingRequest,
): Promise<ActionResult<{ visit: Visit; manageUrl: string; linkTexted: boolean }>> {
  try {
    const response = await getPublicApiClient().createAppointment(request);
    return { ok: true, ...response };
  } catch (error) {
    return toFailure(error);
  }
}

export async function fetchAppointment(token: string): Promise<ActionResult<{ visit: Visit }>> {
  try {
    const visit = await getPublicApiClient().getAppointmentByToken(token);
    return { ok: true, visit };
  } catch (error) {
    return toFailure(error);
  }
}

export async function rescheduleBooking(
  token: string,
  date: string,
  time: string,
): Promise<ActionResult<{ visit: Visit }>> {
  try {
    const visit = await getPublicApiClient().rescheduleAppointment(token, { date, time });
    return { ok: true, visit };
  } catch (error) {
    return toFailure(error);
  }
}

// R80/R230: start times for moving the whole visit, with itself excluded
export async function fetchRescheduleAvailability(
  token: string,
  date: string,
): Promise<ActionResult<{ slots: VisitSlot[] }>> {
  try {
    const slots = await getPublicApiClient().getRescheduleAvailability(token, date);
    return { ok: true, slots };
  } catch (error) {
    return toFailure(error);
  }
}

// R610: the customer confirms they're coming
export async function confirmBooking(token: string): Promise<ActionResult<{ visit: Visit }>> {
  try {
    const visit = await getPublicApiClient().confirmAppointment(token);
    return { ok: true, visit };
  } catch (error) {
    return toFailure(error);
  }
}

export async function cancelBooking(token: string): Promise<ActionResult<{ visit: Visit }>> {
  try {
    const visit = await getPublicApiClient().cancelAppointment(token);
    return { ok: true, visit };
  } catch (error) {
    return toFailure(error);
  }
}

export async function resendLink(phoneNumber: string): Promise<{ ok: true }> {
  await getPublicApiClient()
    .resendMagicLink({ phoneNumber })
    .catch(() => undefined);
  return { ok: true };
}
