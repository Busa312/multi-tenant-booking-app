"use client";

import { useState, type FormEvent } from "react";
import type { Location, Service } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import type { FailureReason } from "@/lib/actions";
import { BookingSummary } from "./BookingSummary";
import styles from "./StepDetails.module.css";

interface StepDetailsProps {
  services: Service[];
  location: Location | null;
  professionalName: string | null;
  startAt: string | null;
  timezone: string;
  locale: string;
  isSubmitting: boolean;
  error: FailureReason | null;
  onSubmit: (details: { userName: string; phoneNumber: string; email: string }) => void;
  onBack: () => void;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

export function StepDetails({
  services,
  location,
  professionalName,
  startAt,
  timezone,
  locale,
  isSubmitting,
  error,
  onSubmit,
  onBack,
  t,
  text,
}: StepDetailsProps) {
  const [userName, setUserName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ userName: userName.trim(), phoneNumber: phoneNumber.trim(), email: email.trim() });
  };

  return (
    <section className={styles.step}>
      <h2 className={styles.heading}>{t("booking.details.heading")}</h2>

      <BookingSummary
        services={services}
        location={location}
        professionalName={professionalName}
        startAt={startAt}
        timezone={timezone}
        locale={locale}
        t={t}
        text={text}
      />

      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span className={styles.label}>{t("booking.details.name")}</span>
          <input
            className={styles.input}
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            required
            autoComplete="name"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("booking.details.phone")}</span>
          <input
            className={styles.input}
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            required
            autoComplete="tel"
            inputMode="tel"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("booking.details.emailOptional")}</span>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <span className={styles.hint}>{t("booking.details.emailHint")}</span>
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {t("common.somethingWrong")}
          </p>
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.back} onClick={onBack} disabled={isSubmitting}>
            {t("common.back")}
          </button>
          <button type="submit" className={styles.submit} disabled={isSubmitting || !startAt}>
            {isSubmitting ? t("booking.details.submitting") : t("booking.details.submit")}
          </button>
        </div>
      </form>
    </section>
  );
}
