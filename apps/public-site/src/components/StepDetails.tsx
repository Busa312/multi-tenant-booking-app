"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Location, Service, VisitSlot } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import type { FailureReason } from "@/lib/actions";
import { BookingSummary } from "./BookingSummary";
import type { CustomerDetails } from "./BookingWizard";
import { BTN_BACK, BTN_NEXT, FIELD, FOOTER, INPUT, LABEL, STEP, STEP_HEADING } from "@/lib/wizardClasses";

interface StepDetailsProps {
  services: Service[];
  location: Location | null;
  /** The chosen start and its plan (R200). */
  slot: VisitSlot | null;
  serviceName: (id: string) => string;
  professionalName: (id: string | null) => string | null;
  timezone: string;
  locale: string;
  isSubmitting: boolean;
  error: FailureReason | null;
  /** What was typed before — coming back from the code step, or after a language switch. */
  initial: CustomerDetails | null;
  /** Every keystroke, so the wizard can keep it across a language switch. */
  onChange: (details: CustomerDetails) => void;
  onSubmit: (details: CustomerDetails) => void;
  onBack: () => void;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

export function StepDetails({
  services,
  location,
  slot,
  serviceName,
  professionalName,
  timezone,
  locale,
  isSubmitting,
  error,
  initial,
  onChange,
  onSubmit,
  onBack,
  t,
  text,
}: StepDetailsProps) {
  const [userName, setUserName] = useState(initial?.userName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initial?.phoneNumber ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");

  useEffect(() => {
    onChange({ userName, phoneNumber, email });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, phoneNumber, email]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ userName: userName.trim(), phoneNumber: phoneNumber.trim(), email: email.trim() });
  };

  return (
    <section className={STEP}>
      <h2 className={STEP_HEADING}>{t("booking.details.heading")}</h2>

      <BookingSummary
        startAt={slot?.startAt ?? null}
        location={
          location
            ? `${text(location.name, location.nameI18n)} — ${text(location.addressLine, location.addressLineI18n)}`
            : null
        }
        plan={(slot?.segments ?? []).map((segment) => ({
          key: `${segment.startAt}-${segment.professionalId}`,
          startAt: segment.startAt,
          endAt: segment.endAt,
          services: segment.serviceIds.map(serviceName).join(", "),
          professional: professionalName(segment.professionalId),
        }))}
        total={services.reduce((sum, service) => sum + Number(service.price), 0).toFixed(2)}
        timezone={timezone}
        locale={locale}
        t={t}
      />

      <form className="flex flex-col gap-4" onSubmit={submit}>
        <label className={FIELD}>
          <span className={LABEL}>{t("booking.details.name")}</span>
          <input
            className={INPUT}
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            required
            autoComplete="name"
          />
        </label>

        <label className={FIELD}>
          <span className={LABEL}>{t("booking.details.phone")}</span>
          <input
            className={INPUT}
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            required
            autoComplete="tel"
            inputMode="tel"
          />
        </label>

        <label className={FIELD}>
          <span className={LABEL}>{t("booking.details.emailOptional")}</span>
          <input
            className={INPUT}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <span className="text-xs text-base-content/60">{t("booking.details.emailHint")}</span>
        </label>

        {error && (
          <p className="alert alert-soft alert-error" role="alert">
            {t("common.somethingWrong")}
          </p>
        )}

        <div className={FOOTER}>
          <button type="button" className={BTN_BACK} onClick={onBack} disabled={isSubmitting}>
            {t("common.back")}
          </button>
          <button type="submit" className={BTN_NEXT} disabled={isSubmitting || !slot}>
            {isSubmitting ? t("booking.details.submitting") : t("booking.details.submit")}
          </button>
        </div>
      </form>
    </section>
  );
}
