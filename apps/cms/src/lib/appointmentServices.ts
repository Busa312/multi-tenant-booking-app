import type { AppointmentServiceLine } from "@booking/shared-types";

/**
 * Rendering an appointment's service list.
 *
 * Four surfaces show it — the day table's cell, the week grid's card, the
 * agenda row and the dashboard hero — in containers of very different widths.
 * They share these helpers rather than each joining the array inline, so that
 * "Haircut + Colour" is decided once and a five-service booking doesn't
 * overflow one of them the first time it happens.
 */

/** How many names to show before the rest become "+N". */
const MAX_NAMES = 2;

export interface AppointmentWithServices {
  services: AppointmentServiceLine[];
  startAt: string;
  endAt: string;
}

/**
 * "Haircut", "Haircut + Beard trim", or "Haircut + Beard trim +2" — the full
 * list is available from `serviceNames` for anywhere that has room for it.
 *
 * An empty list is possible on the wire (the database stopped guaranteeing at
 * least one line when appointment.service_id was dropped), so it answers with a
 * dash rather than an empty cell that reads as a rendering bug.
 */
export function serviceLabel(appointment: AppointmentWithServices): string {
  const names = appointment.services.map((line) => line.name);
  if (names.length === 0) return "—";
  const shown = names.slice(0, MAX_NAMES).join(" + ");
  const hidden = names.length - MAX_NAMES;
  return hidden > 0 ? `${shown} +${hidden}` : shown;
}

/** Every service name, for tooltips and detail views that aren't width-limited. */
export const serviceNames = (appointment: AppointmentWithServices): string =>
  appointment.services.map((line) => line.name).join(" + ");

/**
 * Length of the whole block, from the stored instants rather than by summing
 * the lines: the appointment's real extent is what the calendar lays out, and
 * it stays right even if a line were somehow missing.
 */
export const totalDurationMinutes = (appointment: AppointmentWithServices): number =>
  Math.round((new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60_000);
