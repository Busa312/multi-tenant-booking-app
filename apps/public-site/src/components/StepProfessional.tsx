"use client";

import type { Professional } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import styles from "./StepProfessional.module.css";

interface StepProfessionalProps {
  professionals: Professional[] | null;

  selectedId: string | null;
  onSelect: (professionalId: string | null) => void;
  onNext: () => void;
  onBack: () => void;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

export function StepProfessional({
  professionals,
  selectedId,
  onSelect,
  onNext,
  onBack,
  t,
  text,
}: StepProfessionalProps) {
  return (
    <section className={styles.step}>
      <h2 className={styles.heading}>{t("booking.professional.heading")}</h2>

      {professionals === null ? (
        <p className={styles.hint}>{t("common.loading")}</p>
      ) : (
        <ul className={styles.list} role="radiogroup" aria-label={t("booking.professional.heading")}>
          <li>
            <button
              type="button"
              role="radio"
              aria-checked={selectedId === null}
              className={styles.option}
              onClick={() => onSelect(null)}
            >
              <span className={styles.name}>{t("booking.professional.any")}</span>
              <span className={styles.note}>{t("booking.professional.anyHint")}</span>
            </button>
          </li>

          {professionals.map((professional) => (
            <li key={professional.id}>
              <button
                type="button"
                role="radio"
                aria-checked={professional.id === selectedId}
                className={styles.option}
                onClick={() => onSelect(professional.id)}
              >
                <span className={styles.name}>{text(professional.name, professional.nameI18n)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {professionals?.length === 0 && <p className={styles.empty}>{t("booking.professional.empty")}</p>}

      <div className={styles.footer}>
        <button type="button" className={styles.back} onClick={onBack}>
          {t("common.back")}
        </button>
        <button type="button" className={styles.next} onClick={onNext}>
          {t("common.next")}
        </button>
      </div>
    </section>
  );
}
