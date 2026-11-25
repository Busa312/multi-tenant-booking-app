import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import { Icon } from "./ui/Icon.js";

interface HomeVisitAddressProps {
  appointment: Pick<
    AppointmentSummary,
    "place" | "customerAddress" | "customerAddressDetails" | "customerAddressNote" | "travelMinutes" | "homeVisitFee"
  >;
  /** One line, for cards and agenda rows. */
  compact?: boolean;
  className?: string;
}

/** A search link: works in every maps app's browser fallback, needs no key. */
const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

// R630: where the professional goes. Renders nothing for a visit at the business.
export function HomeVisitAddress({ appointment, compact, className }: HomeVisitAddressProps) {
  const { t } = useI18n();
  const address = appointment.customerAddress;
  if (appointment.place !== "customer" || !address) return null;
  const where = [address, appointment.customerAddressDetails].filter(Boolean).join(", ");

  if (compact) {
    return (
      <div className={cx("flex min-w-0 items-center gap-1 text-xs text-base-content/70", className)} title={where}>
        <Icon name="home_pin" size={14} className="flex-none" />
        <span className="truncate">{where}</span>
      </div>
    );
  }

  const fee = Number(appointment.homeVisitFee);
  return (
    <div className={cx("flex flex-col gap-0.5 text-xs text-base-content/70", className)}>
      <div className="flex items-start gap-1">
        <Icon name="home_pin" size={14} className="mt-px flex-none" />
        <span className="min-w-0">
          <span className="font-semibold text-base-content">{t("bookings.homeVisit")}</span> · {where}
        </span>
      </div>
      {appointment.customerAddressNote && <div className="pl-[18px] italic">{appointment.customerAddressNote}</div>}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-[18px]">
        <a className="link link-hover inline-flex items-center gap-0.5" href={mapsUrl(where)} target="_blank" rel="noopener noreferrer">
          {t("bookings.openInMaps")}
          <Icon name="open_in_new" size={12} />
        </a>
        {appointment.travelMinutes > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Icon name="directions_car" size={13} />
            {t("bookings.travelTime", { count: appointment.travelMinutes })}
          </span>
        )}
        {fee > 0 && <span>{t("bookings.homeVisitFee", { amount: `${appointment.homeVisitFee} ₾` })}</span>}
      </div>
    </div>
  );
}
