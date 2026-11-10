import type { ServiceSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { Button, Select } from "./ui/index.js";

interface BookingServiceRowProps {
  /** Already narrowed by the parent to what's selectable in this row. */
  options: ServiceSummary[];
  value: string;
  /** Row index, for the input id and so the parent knows which row changed. */
  index: number;
  /** Hidden on the only row — a booking always has at least one service. */
  canRemove: boolean;
  onChange: (serviceId: string) => void;
  onRemove: () => void;
}

/**
 * One service on a booking. Dumb `value`/`onChange` like ScheduleDayRow — the
 * modal owns the whole list, this owns nothing.
 */
export function BookingServiceRow({
  options,
  value,
  index,
  canRemove,
  onChange,
  onRemove,
}: BookingServiceRowProps) {
  const { t } = useI18n();
  const nameOf = useLocalizedName();
  const id = `booking-service-${index}`;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 [&+&]:mt-2">
      <Select
        id={id}
        value={value}
        onChange={onChange}
        placeholder={t("bookings.servicePlaceholder")}
        options={options.map((s) => ({
          value: s.id,
          label: t("bookings.serviceOption", { name: nameOf(s.name, s.nameI18n), minutes: s.durationMinutes, price: s.price }),
        }))}
      />
      {/* Kept mounted but invisible on the single-row case, so the select
          doesn't change width the moment a second service is added. */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        iconOnly
        icon="delete"
        title={t("bookings.removeService")}
        aria-label={t("bookings.removeService")}
        onClick={onRemove}
        className={canRemove ? undefined : "invisible"}
        disabled={!canRemove}
      />
    </div>
  );
}
