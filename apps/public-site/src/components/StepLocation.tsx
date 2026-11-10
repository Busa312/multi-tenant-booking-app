"use client";

import { localizedAddress } from "@booking/shared-types";
import type { Location, PublicProfessional } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import {
  BTN_BACK,
  BTN_NEXT,
  FOOTER,
  OPTION_CARD,
  OPTION_LIST,
  STEP,
  STEP_HEADING,
  STEP_HINT,
} from "@/lib/wizardClasses";
import { locationServes } from "@/lib/visit-booking";

interface StepLocationProps {
  locations: Location[];
  professionals: PublicProfessional[];
  /** The services already chosen — a branch is only offered if it can do all of them (R240). */
  serviceIds: string[];
  selectedId: string | null;
  onSelect: (locationId: string) => void;
  onNext: () => void;
  onBack: () => void;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

export function StepLocation({
  locations,
  professionals,
  serviceIds,
  selectedId,
  onSelect,
  onNext,
  onBack,
  t,
  text,
}: StepLocationProps) {
  const selectedServes = selectedId !== null && locationServes(professionals, selectedId, serviceIds);

  return (
    <section className={STEP}>
      <h2 className={STEP_HEADING}>{t("booking.location.heading")}</h2>
      <p className={STEP_HINT}>{t("booking.location.hint")}</p>

      <ul className={OPTION_LIST} role="radiogroup" aria-label={t("booking.location.heading")}>
        {locations.map((location) => {
          const serves = locationServes(professionals, location.id, serviceIds);
          return (
            <li key={location.id}>
              <button
                type="button"
                role="radio"
                aria-checked={location.id === selectedId}
                className={`${OPTION_CARD} disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-base-300`}
                disabled={!serves}
                onClick={() => onSelect(location.id)}
              >
                <span className="font-semibold">{text(location.name, location.nameI18n)}</span>
                <span className="text-sm text-base-content/65">
                  {serves ? localizedAddress(location, text) : t("booking.location.unavailable")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className={FOOTER}>
        <button type="button" className={BTN_BACK} onClick={onBack}>
          {t("common.back")}
        </button>
        <button type="button" className={BTN_NEXT} onClick={onNext} disabled={!selectedServes}>
          {t("common.next")}
        </button>
      </div>
    </section>
  );
}
