"use server";

import { ApiError } from "@booking/api-client";
import type { Appointment, AvailabilitySlot, Professional } from "@booking/shared-types";
import { getPublicApiClient } from "./api";

export type ActionResult<T> = ({ ok: true } & T) | { ok: false; reason: FailureReason };

export type FailureReason = "conflict" | "invalid" | "notFound" | "unknown";

function toFailure(error: unknown): { ok: false; reason: FailureReason } {
  if (error instanceof ApiError) {
    if (error.status === 409) return { ok: false, reason: "conflict" };
    if (error.status === 404) return { ok: false, reason: "notFound" };
    if (error.status === 400) return { ok: false, reason: "invalid" };
  }
  return { ok: false, reason: "unknown" };
}

export interface AvailabilityRequest {
  serviceIds: string[];
  professionalId?: string;
  locationId?: string;

  date: string;
}

export async function fetchAvailability(
  request: AvailabilityRequest,
): Promise<ActionResult<{ slots: AvailabilitySlot[] }>> {
  try {
    const slots = await getPublicApiClient().getAvailability(request);
    return { ok: true, slots };
  } catch (error) {
    return toFailure(error);
  }
}

// R180: the staff bookable at one branch
export async function fetchProfessionals(
  locationId?: string,
): Promise<ActionResult<{ professionals: Professional[] }>> {
  try {
    const professionals = await getPublicApiClient().listProfessionals(locationId);
    return { ok: true, professionals };
  } catch (error) {
    return toFailure(error);
  }
}

export async function startVerification(
  phoneNumber: string,
): Promise<ActionResult<{ expiresAt: string; devCode: string | null }>> {
  try {
    const response = await getPublicApiClient().startVerification({ phoneNumber });
    return { ok: true, ...response };
  } catch (error) {
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
  professionalId?: string;
  locationId?: string;
  date: string;
  time: string;
  userName: string;
  phoneNumber: string;
  email?: string;
  verificationToken: string;
}

export async function submitBooking(
  request: BookingRequest,
): Promise<ActionResult<{ appointmentId: string; startAt: string; endAt: string; manageUrl: string }>> {
  try {
    const response = await getPublicApiClient().createAppointment(request);
    return { ok: true, ...response };
  } catch (error) {
    return toFailure(error);
  }
}

export async function fetchAppointment(token: string): Promise<ActionResult<{ appointment: Appointment }>> {
  try {
    const appointment = await getPublicApiClient().getAppointmentByToken(token);
    return { ok: true, appointment };
  } catch (error) {
    return toFailure(error);
  }
}

export async function rescheduleBooking(
  token: string,
  date: string,
  time: string,
): Promise<ActionResult<{ appointment: Appointment; manageUrl: string }>> {
  try {
    const { appointment, manageUrl } = await getPublicApiClient().rescheduleAppointment(token, { date, time });
    return { ok: true, appointment, manageUrl };
  } catch (error) {
    return toFailure(error);
  }
}

// R80: slots for re-timing one appointment, with itself excluded
export async function fetchRescheduleAvailability(
  token: string,
  date: string,
): Promise<ActionResult<{ slots: AvailabilitySlot[] }>> {
  try {
    const slots = await getPublicApiClient().getRescheduleAvailability(token, date);
    return { ok: true, slots };
  } catch (error) {
    return toFailure(error);
  }
}

export async function cancelBooking(token: string): Promise<ActionResult<{ appointment: Appointment }>> {
  try {
    const appointment = await getPublicApiClient().cancelAppointment(token);
    return { ok: true, appointment };
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
