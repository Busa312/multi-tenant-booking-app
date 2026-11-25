"use client";

import { useState } from "react";
import { MAX_SERVICES_PER_BOOKING, groupServices } from "@booking/shared-types";
import type { PublicProfessional, Service, ServiceCategory } from "@booking/shared-types";
import { priceText } from "@/lib/price";
import type { Translate } from "@/i18n/locales";
import { BTN_BACK, BTN_NEXT, FOOTER, OPTION_LIST, STATUS_TEXT, STEP, STEP_HEADING, STEP_HINT } from "@/lib/wizardClasses";
import { isBookable } from "@/lib/visit-booking";
import { DisclosureChevron } from "./DisclosureChevron";

interface StepServicesProps {
  services: Service[];
  /** R510: the salon's headings, in its order. */
  categories: ServiceCategory[];
  /** R240: everyone, with what they perform — decides what can be picked at all. */
  professionals: PublicProfessional[];
  selectedIds: string[];
  onChange: (serviceIds: string[]) => void;
  onNext: () => void;
  /** R630: back to "Where?", when it came first. */
  onBack?: () => void;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

export function StepServices({ services, categories, professionals, selectedIds, onChange, onNext, onBack, t, text }: StepServicesProps) {
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
  // R510: under the salon's headings, when it has them
  const groups = groupServices(services, categories);
  const titled = groups.some((group) => group.category !== null);
  const groupKey = (group: (typeof groups)[number]) => group.category?.id ?? "other";
  // R510: which categories are open. To begin with: every one holding a service
  // already chosen (coming back to this step, a deep link, a restored draft),
  // or else the first. After that only the customer opens and closes them —
  // picking a service never folds another category away under them.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const chosen = groups.filter((group) => group.services.some((service) => selectedIds.includes(service.id))).map(groupKey);
    const first = groups[0];
    return new Set(chosen.length > 0 ? chosen : first ? [groupKey(first)] : []);
  });
  const setGroupOpen = (key: string, isOpen: boolean) =>
    setOpen((current) => {
      if (current.has(key) === isOpen) return current;
      const next = new Set(current);
      if (isOpen) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <section className={STEP}>
      <h2 className={STEP_HEADING}>{t("booking.services.heading")}</h2>
      <p className={STEP_HINT}>{t("booking.services.hint")}</p>

      {services.length === 0 ? (
        <p className={STATUS_TEXT}>{t("booking.services.empty")}</p>
      ) : (
        <div className={titled ? "divide-y divide-base-300 border-y border-base-300" : undefined}>
          {groups.map((group) => {
            const key = groupKey(group);
            const list = (
              <ul className={OPTION_LIST}>
                {group.services.map((service) => {
                  const isSelected = selectedIds.includes(service.id);
                  const position = selectedIds.indexOf(service.id) + 1;
                  // R240: nobody performs it; R210: five already chosen
                  const bookable = isBookable(professionals, service.id);
                  const disabled = !bookable || (atLimit && !isSelected);
                  return (
                    <li key={service.id}>
                      <label
                        className="flex cursor-pointer items-center gap-3.5 rounded-box border border-base-300 bg-base-100 px-5 py-4 transition-[border-color,box-shadow] hover:border-base-content/40 data-disabled:cursor-not-allowed data-disabled:opacity-55 data-disabled:hover:border-base-300 data-selected:border-primary data-selected:ring-1 data-selected:ring-primary motion-reduce:transition-none"
                        data-selected={isSelected || undefined}
                        data-disabled={disabled || undefined}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => toggle(service.id)}
                        />
                        <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span className="font-semibold">
                            {/* Order matters once there are several — it's the order they're done in. */}
                            {isSelected && selectedIds.length > 1 && (
                              <span className="badge badge-secondary badge-sm mr-2 align-middle tabular-nums">{position}</span>
                            )}
                            {text(service.name, service.nameI18n)}
                          </span>
                          <span className="text-sm text-base-content/65 tabular-nums">
                            {bookable
                              ? `${t("home.minutes", { count: service.durationMinutes })} · ${priceText(t, service.price, service.priceFrom)}`
                              : t("booking.services.unavailable")}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            );
            if (!titled) return <div key={key}>{list}</div>;
            const chosenHere = group.services.filter((service) => selectedIds.includes(service.id)).length;
            // R510: a category opens and closes on a click; several can be open.
            return (
              <details
                key={key}
                className="group"
                open={open.has(key)}
                onToggle={(event) => setGroupOpen(key, event.currentTarget.open)}
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {group.category ? text(group.category.name, group.category.nameI18n) : t("home.otherServices")}
                  </h3>
                  <span className="text-sm text-base-content/50 tabular-nums">{group.services.length}</span>
                  {chosenHere > 0 && (
                    <span className="badge badge-primary badge-sm tabular-nums">
                      {t("booking.services.selectedInCategory", { count: chosenHere })}
                    </span>
                  )}
                  <span className="ml-auto">
                    <DisclosureChevron />
                  </span>
                </summary>
                <div className="pb-4">{list}</div>
              </details>
            );
          })}
        </div>
      )}

      {atLimit && (
        <p className="text-sm text-base-content/65" role="status">
          {t("booking.services.max", { max: MAX_SERVICES_PER_BOOKING })}
        </p>
      )}

      <div className={FOOTER}>
        {onBack && (
          <button type="button" className={BTN_BACK} onClick={onBack}>
            {t("common.back")}
          </button>
        )}
        {selected.length > 0 && (
          <p className="text-sm font-semibold tabular-nums">
            {t("booking.services.totalDuration", { count: totalMinutes })} ·{" "}
            {t("booking.services.totalPrice", {
              // R520: "from" if any of them is a starting price
              price: priceText(t, totalPrice.toFixed(2), selected.some((service) => service.priceFrom)),
            })}
          </p>
        )}
        <button type="button" className={`${BTN_NEXT} ml-auto`} onClick={onNext} disabled={selected.length === 0}>
          {t("common.next")}
        </button>
      </div>
    </section>
  );
}
