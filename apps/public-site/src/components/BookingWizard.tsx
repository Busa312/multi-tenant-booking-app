"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MAX_SERVICES_PER_BOOKING, localized } from "@booking/shared-types";
import type { Location, PublicProfessional, Service, Visit, VisitSlot } from "@booking/shared-types";
import { translator, type Locale, type Messages } from "@/i18n/locales";
import { fetchProfessionals, holdSlot, releaseHold, submitBooking, type FailureReason } from "@/lib/actions";
import { addDays, todayInTimezone, wallClock } from "@/lib/tenant-time";
import { isBookable, professionalIdsFromSlot } from "@/lib/visit-booking";
import { clearWizard, loadWizard, saveWizard, type CodeSent, type WizardState } from "@/lib/wizard-storage";
import { StepProgress } from "./StepProgress";
import { StepServices } from "./StepServices";
import { StepLocation } from "./StepLocation";
import { StepProfessional } from "./StepProfessional";
import { StepDateTime } from "./StepDateTime";
import { StepDetails } from "./StepDetails";
import { StepVerify } from "./StepVerify";
import { ConfirmationPanel } from "./ConfirmationPanel";

interface BookingWizardProps {
  services: Service[];
  locations: Location[];
  /** R240: everyone, with the services they perform. */
  professionals: PublicProfessional[];
  preselectedServiceIds: string[];
  // R150: the branch a "Book at …" button was pressed on
  preselectedLocationId?: string;
  timezone: string;
  /** R290: how many days ahead the salon takes online bookings. */
  maxAdvanceDays: number;
  locale: Locale;
  defaultLocale: string;
  messages: Messages;
}

type StepId = "services" | "location" | "professional" | "time" | "details" | "verify";

export interface BookingDraft {
  // R210: one to five, in the order they'll be performed
  serviceIds: string[];
  locationId: string | null;
  /** R200: aligned with serviceIds; null = any qualified professional. */
  professionalIds: (string | null)[];
  date: string;
  /** The chosen start time and the plan behind it. */
  slot: VisitSlot | null;
  /** R250: the hold on that time, once the API has granted it. */
  hold: { id: string; expiresAt: string } | null;
}

export interface Confirmation {
  visit: Visit;
  manageUrl: string;
  /** R270: the link also went to the customer's phone by SMS. */
  linkTexted: boolean;
  phoneNumber: string;
}

// R270: no email — the verified phone is how the customer gets their link
export interface CustomerDetails {
  userName: string;
  phoneNumber: string;
}

// Restoring runs before the first paint, so a language switch doesn't flash
// step 1 before jumping back. (A layout effect is a no-op on the server.)
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function BookingWizard({
  services,
  locations,
  professionals: allProfessionals,
  preselectedServiceIds,
  preselectedLocationId,
  timezone,
  maxAdvanceDays,
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
  const [draft, setDraft] = useState<BookingDraft>(() => {
    // A deep link can't preselect something that can't be booked (R240/R210).
    const serviceIds = preselectedServiceIds
      .filter((id) => isBookable(allProfessionals, id))
      .slice(0, MAX_SERVICES_PER_BOOKING);
    return {
      serviceIds,
      locationId: preselectedLocationId ?? (locations.length === 1 ? (locations[0]?.id ?? null) : null),
      professionalIds: serviceIds.map(() => null),
      date: todayInTimezone(timezone),
      slot: null,
      hold: null,
    };
  });

  // R150: the branch's staff (plus those at every branch)
  const [professionals, setProfessionals] = useState<PublicProfessional[] | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submitError, setSubmitError] = useState<FailureReason | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Held between the details step and the verification that gates the booking.
  const [details, setDetails] = useState<CustomerDetails | null>(null);
  // The last code sent, so the code step neither re-sends on return nor lets a
  // resend through before its cooldown.
  const [codeSent, setCodeSent] = useState<CodeSent | null>(null);

  // R250: a hold request is in flight; Continue waits for it
  const [isHolding, setIsHolding] = useState(false);
  // R250: the picked time went to someone else — say so and refresh the times
  const [slotTaken, setSlotTaken] = useState(false);
  const [slotsVersion, setSlotsVersion] = useState(0);
  // Each pick (or clear) supersedes the one before: a hold that comes back for a
  // pick that's no longer current is released rather than applied.
  const holdRequest = useRef(0);

  const step = steps[stepIndex] ?? "services";

  // Survive a language switch (and a reload): the page re-mounts under the other
  // locale, so progress is put back from this tab's storage.
  const skipSave = useRef(false);
  useBeforePaint(() => {
    // Under StrictMode this runs twice; the first commit's save must not
    // overwrite what the second run is about to read.
    skipSave.current = true;
    const saved = loadWizard();
    if (!saved) return;
    if (saved.confirmation) {
      setConfirmation(saved.confirmation);
      return;
    }
    const restored = restorable(saved);
    if (!restored) return;
    setDraft(restored.draft);
    setDetails(restored.details);
    setCodeSent(restored.codeSent);
    setStepIndex(restored.stepIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveWizard({ stepIndex, draft, details, codeSent, confirmation });
  }, [stepIndex, draft, details, codeSent, confirmation]);

  /** A saved state that still fits this page's services, branches and staff — anything off, and it's dropped. */
  function restorable(saved: WizardState): WizardState | null {
    const { draft: d } = saved;
    const fits =
      Array.isArray(d.serviceIds) &&
      d.serviceIds.length <= MAX_SERVICES_PER_BOOKING &&
      d.serviceIds.every((id) => services.some((service) => service.id === id) && isBookable(allProfessionals, id)) &&
      Array.isArray(d.professionalIds) &&
      d.professionalIds.length === d.serviceIds.length &&
      d.professionalIds.every((id) => id === null || allProfessionals.some((p) => p.id === id)) &&
      (d.locationId === null || locations.some((location) => location.id === d.locationId)) &&
      Number.isInteger(saved.stepIndex) &&
      saved.stepIndex >= 0 &&
      saved.stepIndex < steps.length;
    if (!fits) return null;

    const timeStep = steps.indexOf("time");
    const detailsStep = steps.indexOf("details");
    let stepIndex = saved.stepIndex;
    let draft = d;
    // A day that has gone by: back to picking a time, from today.
    if (draft.date < todayInTimezone(timezone)) {
      draft = { ...draft, date: todayInTimezone(timezone), slot: null, hold: null };
    }
    if (!draft.slot) stepIndex = Math.min(stepIndex, timeStep);
    if (!saved.details) stepIndex = Math.min(stepIndex, detailsStep);
    return { ...saved, stepIndex, draft };
  }

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

  // R160: names resolved once, so every step and the confirmation say the same thing
  const professionalName = useCallback(
    (id: string | null) => {
      const professional = allProfessionals.find((candidate) => candidate.id === id);
      return professional ? text(professional.name, professional.nameI18n) : null;
    },
    [allProfessionals, text],
  );
  const serviceName = useCallback(
    (id: string) => {
      const service = services.find((candidate) => candidate.id === id);
      return service ? text(service.name, service.nameI18n) : "";
    },
    [services, text],
  );

  const update = (patch: Partial<BookingDraft>) => {
    // R250: letting go of a time lets go of its hold, so others can have it now
    // rather than in ten minutes.
    if ("slot" in patch && patch.slot === null) {
      holdRequest.current += 1;
      setIsHolding(false);
      if (draft.hold) void releaseHold(draft.hold.id);
      patch = { ...patch, hold: null };
    }
    setDraft((current) => ({ ...current, ...patch }));
  };

  const timeOf = (slot: VisitSlot) => wallClock(slot.startAt, timezone);

  // R250: picking a time holds it. The selection shows at once; the hold catches up.
  const pickSlot = async (slot: VisitSlot) => {
    const request = ++holdRequest.current;
    const previous = draft.hold;
    setSlotTaken(false);
    setDraft((current) => ({ ...current, slot, hold: null }));
    setIsHolding(true);

    const result = await holdSlot({
      serviceIds: draft.serviceIds,
      professionalIds: professionalIdsFromSlot(slot, draft.serviceIds),
      locationId: draft.locationId ?? undefined,
      date: draft.date,
      time: timeOf(slot),
      replaceHoldId: previous?.id,
    });

    if (request !== holdRequest.current) {
      if (result.ok) void releaseHold(result.holdId);
      return;
    }
    setIsHolding(false);

    if (result.ok) {
      // The plan actually held — re-planned just now, so it may name someone else.
      setDraft((current) => ({ ...current, slot: result.slot, hold: { id: result.holdId, expiresAt: result.expiresAt } }));
    } else if (result.reason === "conflict") {
      setDraft((current) => ({ ...current, slot: null, hold: null }));
      setSlotTaken(true);
      setSlotsVersion((version) => version + 1);
    }
    // Anything else (a hold limit, a network blip): carry on without a hold.
    // The booking re-checks the time when it's made (R260).
  };

  const goNext = () => setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  const goBack = () => setStepIndex((index) => Math.max(index - 1, 0));

  const confirm = async (
    collected: CustomerDetails,
    verificationToken: string,
  ) => {
    const slot = draft.slot;
    if (!slot) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const result = await submitBooking({
      serviceIds: draft.serviceIds,
      professionalIds: professionalIdsFromSlot(slot, draft.serviceIds),
      locationId: draft.locationId ?? undefined,
      date: draft.date,
      time: timeOf(slot),
      ...collected,
      verificationToken,
      holdId: draft.hold?.id,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.reason);

      if (result.reason === "conflict") {
        update({ slot: null });
        setStepIndex(steps.indexOf("time"));
      }
      return;
    }

    setConfirmation({
      visit: result.visit,
      manageUrl: result.manageUrl,
      linkTexted: result.linkTexted,
      phoneNumber: collected.phoneNumber,
    });
  };

  if (confirmation) {
    return (
      <ConfirmationPanel
        confirmation={confirmation}
        timezone={timezone}
        locale={locale}
        t={t}
        text={text}
        onBookAnother={() => {
          // A clean start: no saved progress, no deep-link preselection.
          clearWizard();
          window.location.assign("/book");
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("booking.title")}</h1>
      <StepProgress
        steps={steps.map((id) => t(`booking.steps.${id}`))}
        current={stepIndex}
        label={t("booking.stepOf", { current: stepIndex + 1, total: steps.length })}
      />

      {submitError === "conflict" && (
        <div className="alert alert-soft alert-warning" role="alert">
          {t("booking.details.slotTaken")}
        </div>
      )}

      {step === "services" && (
        <StepServices
          services={services}
          professionals={allProfessionals}
          selectedIds={draft.serviceIds}
          onChange={(serviceIds) =>
            // A new selection resets who-does-what; nothing chosen yet means "any".
            update({ serviceIds, professionalIds: serviceIds.map(() => null), slot: null })
          }
          onNext={goNext}
          t={t}
          text={text}
        />
      )}

      {step === "location" && (
        <StepLocation
          locations={locations}
          professionals={allProfessionals}
          serviceIds={draft.serviceIds}
          selectedId={draft.locationId}
          onSelect={(locationId) =>
            update({ locationId, professionalIds: draft.serviceIds.map(() => null), slot: null })
          }
          onNext={goNext}
          onBack={goBack}
          t={t}
          text={text}
        />
      )}

      {step === "professional" && (
        <StepProfessional
          services={selectedServices}
          professionals={professionals}
          locationId={draft.locationId}
          selectedIds={draft.professionalIds}
          onChange={(professionalIds) => update({ professionalIds, slot: null })}
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
          lastDate={addDays(todayInTimezone(timezone), maxAdvanceDays)}
          locale={locale}
          onPickDate={(date) => {
            setSlotTaken(false);
            update({ date, slot: null });
          }}
          onPickSlot={(slot) => void pickSlot(slot)}
          isHolding={isHolding}
          slotTaken={slotTaken}
          slotsVersion={slotsVersion}
          serviceName={serviceName}
          professionalName={professionalName}
          onNext={goNext}
          onBack={goBack}
          t={t}
        />
      )}

      {step === "details" && (
        <StepDetails
          services={selectedServices}
          location={selectedLocation}
          slot={draft.slot}
          serviceName={serviceName}
          professionalName={professionalName}
          timezone={timezone}
          locale={locale}
          isSubmitting={isSubmitting}
          error={submitError === "conflict" ? null : submitError}
          initial={details}
          onChange={setDetails}
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
          codeSent={codeSent}
          onCodeSent={setCodeSent}
          onVerified={(verificationToken) => void confirm(details, verificationToken)}
          onBack={goBack}
          t={t}
        />
      )}
    </div>
  );
}
