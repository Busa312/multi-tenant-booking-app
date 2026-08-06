import type { ServiceSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { BookingServiceRow } from "./BookingServiceRow.js";
import { Button, Eyebrow } from "./ui/index.js";
import styles from "./BookingServiceRows.module.css";

interface BookingServiceRowsProps {
  /** Every service the tenant has; this component does the filtering. */
  services: ServiceSummary[];
  /** One entry per row; "" is an empty row the staff member hasn't filled in. */
  value: string[];
  /** Set when a professional is already chosen — rows narrow to what they perform. */
  professionalId: string;
  /**
   * Services already on the appointment being edited. They stay selectable even
   * if deactivated since, the way the API keeps them bookable — otherwise the
   * form would silently drop one on save.
   */
  keepSelectable?: string[];
  onChange: (serviceIds: string[]) => void;
}

/**
 * The service list of a booking: one row per service, a button to add another,
 * and a running total of what's been picked.
 *
 * The services run back-to-back with one professional, which is exactly what
 * AvailabilityService computes — it sums the durations into a single block and
 * only offers slots for someone who performs all of them.
 */
export function BookingServiceRows({
  services,
  value,
  professionalId,
  keepSelectable = [],
  onChange,
}: BookingServiceRowsProps) {
  const { t } = useI18n();

  // R120/R140: a deactivated service isn't offered, and neither is one the
  // chosen professional doesn't perform. A service already selected in *this*
  // row stays listed regardless, so the row can render its own value.
  const selectableFor = (rowValue: string) =>
    services.filter(
      (s) =>
        s.id === rowValue ||
        ((s.isActive || keepSelectable.includes(s.id)) &&
          (!professionalId || s.professionalIds.includes(professionalId)) &&
          // Each service can only be booked once per appointment, so one already
          // taken by another row is not on offer here.
          !value.includes(s.id)),
    );

  const chosen = value.filter(Boolean);
  const picked = chosen
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is ServiceSummary => s !== undefined);
  const totalMinutes = picked.reduce((total, s) => total + s.durationMinutes, 0);
  const totalPrice = picked.reduce((total, s) => total + Number(s.price), 0);

  const replaceAt = (index: number, serviceId: string) =>
    onChange(value.map((current, i) => (i === index ? serviceId : current)));

  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index));

  // Nothing left to offer means every service is already on the booking.
  const canAdd = value.every(Boolean) && selectableFor("").length > 0;

  return (
    <div className={styles.root}>
      <Eyebrow>{t("bookings.servicesLabel")}</Eyebrow>

      {value.map((serviceId, index) => (
        <BookingServiceRow
          // Index as key: rows have no identity of their own until filled in,
          // and an empty row would collide with the next empty one by value.
          key={index}
          options={selectableFor(serviceId)}
          value={serviceId}
          index={index}
          canRemove={value.length > 1}
          onChange={(next) => replaceAt(index, next)}
          onRemove={() => removeAt(index)}
        />
      ))}

      <div className={styles.footer}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon="add"
          onClick={() => onChange([...value, ""])}
          disabled={!canAdd}
        >
          {t("bookings.addService")}
        </Button>
        {picked.length > 1 && (
          <span className={styles.summary}>
            {t("bookings.servicesSummary", {
              count: picked.length,
              minutes: totalMinutes,
              // Prices are two-decimal strings on the wire; formatted here only
              // for display, while the API does the real sum in Decimal.
              price: totalPrice.toFixed(2),
            })}
          </span>
        )}
      </div>
    </div>
  );
}
