"use client";

import type { Location } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import styles from "./StepLocation.module.css";

interface StepLocationProps {
  locations: Location[];
  selectedId: string | null;
  onSelect: (locationId: string) => void;
  onNext: () => void;
  onBack: () => void;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

export function StepLocation({ locations, selectedId, onSelect, onNext, onBack, t, text }: StepLocationProps) {
  return (
    <section className={styles.step}>
      <h2 className={styles.heading}>{t("booking.location.heading")}</h2>
      <p className={styles.hint}>{t("booking.location.hint")}</p>

      <ul className={styles.list} role="radiogroup" aria-label={t("booking.location.heading")}>
        {locations.map((location) => {
          const address = text(location.addressLine, location.addressLineI18n);
          return (
            <li key={location.id}>
              <button
                type="button"
                role="radio"
                aria-checked={location.id === selectedId}
                className={styles.option}
                onClick={() => onSelect(location.id)}
              >
                <span className={styles.name}>{text(location.name, location.nameI18n)}</span>
                <span className={styles.address}>{location.city ? `${address}, ${location.city}` : address}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className={styles.footer}>
        <button type="button" className={styles.back} onClick={onBack}>
          {t("common.back")}
        </button>
        <button type="button" className={styles.next} onClick={onNext} disabled={!selectedId}>
          {t("common.next")}
        </button>
      </div>
    </section>
  );
}
