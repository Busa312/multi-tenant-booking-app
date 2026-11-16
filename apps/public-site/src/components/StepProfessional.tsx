"use client";

import { useState } from "react";
import type { PublicProfessional, Service } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import { BTN_BACK, BTN_NEXT, FOOTER, OPTION_CARD, OPTION_LIST, STATUS_TEXT, STEP, STEP_HEADING } from "@/lib/wizardClasses";
import { allRounders, qualifiedFor } from "@/lib/visit-booking";
import { ServiceProfessionalPicker } from "./ServiceProfessionalPicker";

// One per line, all one height: "Any available" carries a hint line and the
// people don't, so the minimum is the hinted card's height and a name-only card
// centres its single line in it.
const PROFESSIONAL_CARD = `${OPTION_CARD} min-h-19 justify-center`;

interface StepProfessionalProps {
  /** The chosen services, in the order they'll be performed. */
  services: Service[];
  /** The branch's staff (plus those at every branch); null while loading. */
  professionals: PublicProfessional[] | null;
  locationId: string | null;
  /** R200: aligned with services; null = any available. */
  selectedIds: (string | null)[];
  onChange: (professionalIds: (string | null)[]) => void;
  onNext: () => void;
  /** Absent when this is the first step (R440: the steps before it had nothing to choose). */
  onBack?: () => void;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

/**
 * R200: one person for everything when someone can do it all — the simple case
 * and the common one — otherwise, or on request, a choice per service. "Any
 * available" is always offered and is what most customers want.
 */
export function StepProfessional({
  services,
  professionals,
  locationId,
  selectedIds,
  onChange,
  onNext,
  onBack,
  t,
  text,
}: StepProfessionalProps) {
  const serviceIds = services.map((service) => service.id);
  const rounders = professionals ? allRounders(professionals, serviceIds, locationId) : [];
  const canShare = rounders.length > 0;
  const mixed = new Set(selectedIds).size > 1;
  const [perServiceChosen, setPerServiceChosen] = useState(mixed);
  const perService = professionals !== null && (!canShare || perServiceChosen);

  // R240: shouldn't happen (earlier steps block it), but never let it through
  const uncovered = professionals
    ? services.filter((service) => qualifiedFor(professionals, service.id, locationId).length === 0)
    : [];

  const sharedValue = mixed ? undefined : (selectedIds[0] ?? null);
  const pickForAll = (id: string | null) => onChange(serviceIds.map(() => id));

  const footer = (
    <div className={FOOTER}>
      {onBack && (
        <button type="button" className={BTN_BACK} onClick={onBack}>
          {t("common.back")}
        </button>
      )}
      <button
        type="button"
        className={BTN_NEXT}
        onClick={onNext}
        disabled={professionals === null || uncovered.length > 0}
      >
        {t("common.next")}
      </button>
    </div>
  );

  if (professionals === null) {
    return (
      <section className={STEP}>
        <h2 className={STEP_HEADING}>{t("booking.professional.heading")}</h2>
        <p className={STATUS_TEXT}>
          <span className="loading loading-spinner loading-sm" aria-hidden="true" />
          {t("common.loading")}
        </p>
        {footer}
      </section>
    );
  }

  return (
    <section className={STEP}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={STEP_HEADING}>{t("booking.professional.heading")}</h2>
        {services.length > 1 && canShare && (
          <button
            type="button"
            className="btn btn-ghost btn-sm text-primary"
            onClick={() => {
              // Switching back to one person resets to "any" rather than
              // silently keeping a mix the customer can no longer see.
              if (perService) pickForAll(null);
              setPerServiceChosen(!perService);
            }}
          >
            {t(perService ? "booking.professional.samePerson" : "booking.professional.perService")}
          </button>
        )}
      </div>

      {uncovered.map((service) => (
        <p key={service.id} className="alert alert-soft alert-warning" role="alert">
          {t("booking.professional.empty", { service: text(service.name, service.nameI18n) })}
        </p>
      ))}

      {perService ? (
        <>
          {!canShare && services.length > 1 && (
            <p className="alert alert-soft alert-info">{t("booking.professional.split")}</p>
          )}
          <div className="grid gap-2.5">
            {services.map((service, index) => (
              <ServiceProfessionalPicker
                key={service.id}
                position={index + 1}
                serviceName={text(service.name, service.nameI18n)}
                qualified={qualifiedFor(professionals, service.id, locationId)}
                value={selectedIds[index] ?? null}
                onChange={(id) => onChange(selectedIds.map((current, i) => (i === index ? id : current)))}
                t={t}
                text={text}
              />
            ))}
          </div>
        </>
      ) : (
        <ul className={OPTION_LIST} role="radiogroup" aria-label={t("booking.professional.heading")}>
          <li>
            <button
              type="button"
              role="radio"
              aria-checked={sharedValue === null}
              className={PROFESSIONAL_CARD}
              onClick={() => pickForAll(null)}
            >
              <span className="font-semibold">{t("booking.professional.any")}</span>
              <span className="text-sm text-base-content/65">{t("booking.professional.anyHint")}</span>
            </button>
          </li>
          {rounders.map((professional) => (
            <li key={professional.id}>
              <button
                type="button"
                role="radio"
                aria-checked={sharedValue === professional.id}
                className={PROFESSIONAL_CARD}
                onClick={() => pickForAll(professional.id)}
              >
                <span className="font-semibold">{text(professional.name, professional.nameI18n)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {footer}
    </section>
  );
}
