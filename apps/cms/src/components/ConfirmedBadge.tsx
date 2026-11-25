import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { Icon, Pill } from "./ui/index.js";

interface ConfirmedBadgeProps {
  appointment: Pick<AppointmentSummary, "status" | "confirmedAt">;
  className?: string;
}

/**
 * R610: the customer confirmed through their reminder link. Only on a booking
 * still to happen — once it's completed or missed, its status says more.
 * Icon and word, never color alone.
 */
export function ConfirmedBadge({ appointment, className }: ConfirmedBadgeProps) {
  const { t } = useI18n();

  if (appointment.status !== "booked" || !appointment.confirmedAt) {
    return null;
  }

  return (
    <span title={t("bookings.confirmedTitle")} className={className}>
      <Pill tone="success">
        <Icon name="check_circle" size={14} />
        {t("bookings.confirmed")}
      </Pill>
    </span>
  );
}
