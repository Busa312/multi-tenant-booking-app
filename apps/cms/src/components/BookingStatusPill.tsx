import type { AppointmentStatus } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { Pill, type PillTone } from "./ui/index.js";

interface BookingStatusPillProps {
  status: AppointmentStatus;
}

// R100: every one of these is a state a person put the appointment in — nothing
// transitions on its own, so "booked" on a past appointment is information, not
// a stale value to style as an error.
const TONES: Record<AppointmentStatus, PillTone> = {
  booked: "neutral",
  completed: "success",
  no_show: "warning",
  cancelled: "danger",
};

export function BookingStatusPill({ status }: BookingStatusPillProps) {
  const { t } = useI18n();
  return <Pill tone={TONES[status]}>{t(`bookings.status_${status}`)}</Pill>;
}
