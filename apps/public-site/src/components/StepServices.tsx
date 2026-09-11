"use client";

import type { Service } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import styles from "./StepServices.module.css";

interface StepServicesProps {
  services: Service[];
  selectedIds: string[];
  onChange: (serviceIds: string[]) => void;
  onNext: () => void;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

export function StepServices({ services, selectedIds, onChange, onNext, t, text }: StepServicesProps) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((current) => current !== id) : [...selectedIds, id]);
  };

  const selected = selectedIds
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is Service => !!service);
  const totalMinutes = selected.reduce((sum, service) => sum + service.durationMinutes, 0);
  const totalPrice = selected.reduce((sum, service) => sum + Number(service.price), 0);

  return (
    <section className={styles.step}>
      <h2 className={styles.heading}>{t("booking.services.heading")}</h2>
      <p className={styles.hint}>{t("booking.services.hint")}</p>

      {services.length === 0 ? (
        <p className={styles.empty}>{t("booking.services.empty")}</p>
      ) : (
        <ul className={styles.list}>
          {services.map((service) => {
            const isSelected = selectedIds.includes(service.id);
            return (
              <li key={service.id}>
                <label className={styles.option} data-selected={isSelected || undefined}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={isSelected}
                    onChange={() => toggle(service.id)}
                  />
                  <span className={styles.optionBody}>
                    <span className={styles.name}>{text(service.name, service.nameI18n)}</span>
                    <span className={styles.meta}>
                      {t("home.minutes", { count: service.durationMinutes })} · {service.price} ₾
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.footer}>
        {selected.length > 0 && (
          <p className={styles.total}>
            {t("booking.services.totalDuration", { count: totalMinutes })} ·{" "}
            {t("booking.services.totalPrice", { price: totalPrice.toFixed(2) })}
          </p>
        )}
        <button type="button" className={styles.next} onClick={onNext} disabled={selected.length === 0}>
          {t("common.next")}
        </button>
      </div>
    </section>
  );
}
