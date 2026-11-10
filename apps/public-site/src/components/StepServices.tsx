"use client";

import { MAX_SERVICES_PER_BOOKING } from "@booking/shared-types";
import type { PublicProfessional, Service } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import { BTN_NEXT, FOOTER, OPTION_LIST, STATUS_TEXT, STEP, STEP_HEADING, STEP_HINT } from "@/lib/wizardClasses";
import { isBookable } from "@/lib/visit-booking";

interface StepServicesProps {
  services: Service[];
  /** R240: everyone, with what they perform — decides what can be picked at all. */
  professionals: PublicProfessional[];
  selectedIds: string[];
  onChange: (serviceIds: string[]) => void;
  onNext: () => void;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

export function StepServices({ services, professionals, selectedIds, onChange, onNext, t, text }: StepServicesProps) {
  const atLimit = selectedIds.length >= MAX_SERVICES_PER_BOOKING;

  // Kept in the order picked: that's the order they'll be performed (R200).
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((current) => current !== id) : [...selectedIds, id]);
  };

  const selected = selectedIds
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is Service => !!service);
  const totalMinutes = selected.reduce((sum, service) => sum + service.durationMinutes, 0);
  const totalPrice = selected.reduce((sum, service) => sum + Number(service.price), 0);

  return (
    <section className={STEP}>
      <h2 className={STEP_HEADING}>{t("booking.services.heading")}</h2>
      <p className={STEP_HINT}>{t("booking.services.hint")}</p>

      {services.length === 0 ? (
        <p className={STATUS_TEXT}>{t("booking.services.empty")}</p>
      ) : (
        <ul className={OPTION_LIST}>
          {services.map((service) => {
            const isSelected = selectedIds.includes(service.id);
            const position = selectedIds.indexOf(service.id) + 1;
            // R240: nobody performs it; R210: five already chosen
            const bookable = isBookable(professionals, service.id);
            const disabled = !bookable || (atLimit && !isSelected);
            return (
              <li key={service.id}>
                <label
                  className="flex cursor-pointer items-center gap-3.5 rounded-box border border-base-300 bg-base-100 px-4 py-3.5 transition-colors hover:border-primary/60 data-disabled:cursor-not-allowed data-disabled:opacity-55 data-disabled:hover:border-base-300 data-selected:border-primary data-selected:bg-primary/8 data-selected:ring-1 data-selected:ring-primary"
                  data-selected={isSelected || undefined}
                  data-disabled={disabled || undefined}
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary rounded-[0.35rem]"
                    checked={isSelected}
                    disabled={disabled}
                    onChange={() => toggle(service.id)}
                  />
                  <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-semibold">
                      {/* Order matters once there are several — it's the order they're done in. */}
                      {isSelected && selectedIds.length > 1 && (
                        <span className="badge badge-primary badge-sm mr-2 align-middle tabular-nums">{position}</span>
                      )}
                      {text(service.name, service.nameI18n)}
                    </span>
                    <span className="text-sm text-base-content/65 tabular-nums">
                      {bookable
                        ? `${t("home.minutes", { count: service.durationMinutes })} · ${service.price} ₾`
                        : t("booking.services.unavailable")}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {atLimit && (
        <p className="text-sm text-base-content/65" role="status">
          {t("booking.services.max", { max: MAX_SERVICES_PER_BOOKING })}
        </p>
      )}

      <div className={FOOTER}>
        {selected.length > 0 && (
          <p className="text-sm font-semibold tabular-nums">
            {t("booking.services.totalDuration", { count: totalMinutes })} ·{" "}
            {t("booking.services.totalPrice", { price: totalPrice.toFixed(2) })}
          </p>
        )}
        <button type="button" className={`${BTN_NEXT} ml-auto`} onClick={onNext} disabled={selected.length === 0}>
          {t("common.next")}
        </button>
      </div>
    </section>
  );
}
