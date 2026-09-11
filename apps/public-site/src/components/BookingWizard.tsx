"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { localized } from "@booking/shared-types";
import type { Location, Professional, Service } from "@booking/shared-types";
import { translator, type Locale, type Messages } from "@/i18n/locales";
import { fetchProfessionals, submitBooking, type FailureReason } from "@/lib/actions";
import { todayInTimezone } from "@/lib/tenant-time";
import { StepProgress } from "./StepProgress";
import { StepServices } from "./StepServices";
import { StepLocation } from "./StepLocation";
import { StepProfessional } from "./StepProfessional";
import { StepDateTime } from "./StepDateTime";
import { StepDetails } from "./StepDetails";
import { StepVerify } from "./StepVerify";
import { ConfirmationPanel } from "./ConfirmationPanel";
import styles from "./BookingWizard.module.css";

interface BookingWizardProps {
  services: Service[];
  locations: Location[];
  preselectedServiceIds: string[];
  // R150: the branch a "Book at …" button was pressed on
  preselectedLocationId?: string;
  timezone: string;
  locale: Locale;
  defaultLocale: string;
  messages: Messages;
}

type StepId = "services" | "location" | "professional" | "time" | "details" | "verify";

export interface BookingDraft {
  serviceIds: string[];
  locationId: string | null;

  professionalId: string | null;
  date: string;

  startAt: string | null;
}

export interface Confirmation {
  appointmentId: string;
  startAt: string;
  manageUrl: string;
  email: string;
}

export function BookingWizard({
  services,
  locations,
  preselectedServiceIds,
  preselectedLocationId,
  timezone,
  locale,
  defaultLocale,
  messages,
}: BookingWizardProps) {
  const t = useMemo(() => translator(messages), [messages]);
  const text = useCallback(
    (plain: string, i18n: unknown) => localized(plain, i18n, locale, defaultLocale),
    [locale, defaultLocale],
  );

  const steps = useMemo<StepId[]>(
    () =>
      locations.length > 1 && !preselectedLocationId
        ? ["services", "location", "professional", "time", "details", "verify"]
        : ["services", "professional", "time", "details", "verify"],
    [locations.length, preselectedLocationId],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<BookingDraft>({
    serviceIds: preselectedServiceIds,
    locationId: preselectedLocationId ?? (locations.length === 1 ? (locations[0]?.id ?? null) : null),
    professionalId: null,
    date: todayInTimezone(timezone),
    startAt: null,
  });

  const [professionals, setProfessionals] = useState<Professional[] | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submitError, setSubmitError] = useState<FailureReason | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Held between the details step and the verification that gates the booking.
  const [details, setDetails] = useState<{ userName: string; phoneNumber: string; email: string } | null>(null);

  const step = steps[stepIndex] ?? "services";

  useEffect(() => {
    let cancelled = false;
    setProfessionals(null);
    void fetchProfessionals(draft.locationId ?? undefined).then((result) => {
      if (cancelled) return;
      setProfessionals(result.ok ? result.professionals : []);
    });
    return () => {
      cancelled = true;
    };
  }, [draft.locationId]);

  const selectedServices = useMemo(
    () => draft.serviceIds.map((id) => services.find((service) => service.id === id)).filter((s): s is Service => !!s),
    [draft.serviceIds, services],
  );
  const selectedLocation = locations.find((location) => location.id === draft.locationId) ?? null;
  const selectedProfessional = professionals?.find((p) => p.id === draft.professionalId) ?? null;
  // R160: resolved here so the summary and the confirmation say the same name
  // the customer picked from, in their own language.
  const selectedProfessionalName = selectedProfessional
    ? text(selectedProfessional.name, selectedProfessional.nameI18n)
    : null;

  const update = (patch: Partial<BookingDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const goNext = () => setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  const goBack = () => setStepIndex((index) => Math.max(index - 1, 0));

  const confirm = async (
    details: { userName: string; phoneNumber: string; email: string },
    verificationToken: string,
  ) => {
    if (!draft.startAt) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const chosen = new Date(draft.startAt);
    const result = await submitBooking({
      serviceIds: draft.serviceIds,
      professionalId: draft.professionalId ?? undefined,
      locationId: draft.locationId ?? undefined,
      date: draft.date,
      time: new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(chosen),
      ...details,
      verificationToken,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.reason);

      if (result.reason === "conflict") {
        update({ startAt: null });
        setStepIndex(steps.indexOf("time"));
      }
      return;
    }

    setConfirmation({
      appointmentId: result.appointmentId,
      startAt: result.startAt,
      manageUrl: result.manageUrl,
      email: details.email,
    });
  };

  if (confirmation) {
    return (
      <ConfirmationPanel
        confirmation={confirmation}
        services={selectedServices}
        location={selectedLocation}
        professionalName={selectedProfessionalName}
        timezone={timezone}
        locale={locale}
        t={t}
        text={text}
      />
    );
  }

  return (
    <div className={styles.wizard}>
      <h1 className={styles.title}>{t("booking.title")}</h1>
      <StepProgress
        steps={steps.map((id) => t(`booking.steps.${id}`))}
        current={stepIndex}
        label={t("booking.stepOf", { current: stepIndex + 1, total: steps.length })}
      />

      {submitError === "conflict" && (
        <p className={styles.conflict} role="alert">
          {t("booking.details.slotTaken")}
        </p>
      )}

      {step === "services" && (
        <StepServices
          services={services}
          selectedIds={draft.serviceIds}
          onChange={(serviceIds) => update({ serviceIds, startAt: null })}
          onNext={goNext}
          t={t}
          text={text}
        />
      )}

      {step === "location" && (
        <StepLocation
          locations={locations}
          selectedId={draft.locationId}
          onSelect={(locationId) =>

            update({ locationId, professionalId: null, startAt: null })
          }
          onNext={goNext}
          onBack={goBack}
          t={t}
          text={text}
        />
      )}

      {step === "professional" && (
        <StepProfessional
          professionals={professionals}
          selectedId={draft.professionalId}
          onSelect={(professionalId) => update({ professionalId, startAt: null })}
          onNext={goNext}
          onBack={goBack}
          t={t}
          text={text}
        />
      )}

      {step === "time" && (
        <StepDateTime
          draft={draft}
          timezone={timezone}
          locale={locale}
          onPickDate={(date) => update({ date, startAt: null })}
          onPickSlot={(startAt, professionalId) =>

            update({ startAt, professionalId: draft.professionalId ?? professionalId })
          }
          onNext={goNext}
          onBack={goBack}
          t={t}
        />
      )}

      {step === "details" && (
        <StepDetails
          services={selectedServices}
          location={selectedLocation}
          professionalName={selectedProfessionalName}
          startAt={draft.startAt}
          timezone={timezone}
          locale={locale}
          isSubmitting={isSubmitting}
          error={submitError === "conflict" ? null : submitError}
          onSubmit={(collected) => {
            setDetails(collected);
            goNext();
          }}
          onBack={goBack}
          t={t}
          text={text}
        />
      )}

      {step === "verify" && details && (
        <StepVerify
          phoneNumber={details.phoneNumber}
          onVerified={(verificationToken) => void confirm(details, verificationToken)}
          onBack={goBack}
          t={t}
        />
      )}
    </div>
  );
}
