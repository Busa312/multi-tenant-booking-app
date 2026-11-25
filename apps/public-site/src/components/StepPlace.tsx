"use client";

import type { VisitPlace } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import { priceText } from "@/lib/price";
import { BTN_NEXT, FOOTER, OPTION_CARD, OPTION_LIST, STEP, STEP_HEADING, STEP_HINT } from "@/lib/wizardClasses";

interface StepPlaceProps {
  selected: VisitPlace | null;
  /** The salon's name, as the visitor reads it. */
  salonName: string;
  /** R630: the salon's fee, added once to a visit at the customer's address; "0" = none. */
  homeVisitFee: string;
  /** Whether it applies to all, some or none of the services offered there. */
  feeApplies: "all" | "some" | "none";
  onSelect: (place: VisitPlace) => void;
  onNext: () => void;
  t: Translate;
}

// R630: "Where?" — first, and only for a salon that does something at the
// customer's address. The services that follow are the ones offered there.
export function StepPlace({ selected, salonName, homeVisitFee, feeApplies, onSelect, onNext, t }: StepPlaceProps) {
  const fee = Number(homeVisitFee) > 0 && feeApplies !== "none" ? priceText(t, homeVisitFee, false) : null;
  const options: { place: VisitPlace; title: string; hint: string }[] = [
    { place: "business", title: t("booking.place.business", { salon: salonName }), hint: t("booking.place.businessHint") },
    {
      place: "customer",
      title: t("booking.place.customer"),
      hint: !fee
        ? t("booking.place.customerHint")
        : feeApplies === "all"
          ? t("booking.place.customerFeeHint", { fee })
          : t("booking.place.customerSomeFeeHint", { fee }),
    },
  ];

  return (
    <section className={STEP}>
      <h2 className={STEP_HEADING}>{t("booking.place.heading")}</h2>
      <p className={STEP_HINT}>{t("booking.place.hint")}</p>

      <ul className={OPTION_LIST} role="radiogroup" aria-label={t("booking.place.heading")}>
        {options.map((option) => (
          <li key={option.place}>
            <button
              type="button"
              role="radio"
              aria-checked={option.place === selected}
              className={OPTION_CARD}
              onClick={() => onSelect(option.place)}
            >
              <span className="font-semibold">{option.title}</span>
              <span className="text-sm text-base-content/65">{option.hint}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className={FOOTER}>
        <button type="button" className={BTN_NEXT} onClick={onNext} disabled={selected === null}>
          {t("common.next")}
        </button>
      </div>
    </section>
  );
}
