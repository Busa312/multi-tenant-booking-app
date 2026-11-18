"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MAX_SERVICES_PER_BOOKING, localized } from "@booking/shared-types";
import type { Location, PublicProfessional, Service, ServiceCategory, Visit, VisitSlot } from "@booking/shared-types";
import { translator, type Locale, type Messages } from "@/i18n/locales";
import { fetchProfessionals, holdSlot, releaseHold, submitBooking, type FailureReason } from "@/lib/actions";
import { addDays, formatInstant, todayInTimezone, wallClock } from "@/lib/tenant-time";
import { postToHost } from "@/lib/embed";
import { useLocaleHref } from "@/lib/useLocaleHref";
import {
  bookingSteps,
  isBookable,
  onlyBookableService,
  professionalIdsFromSlot,
  type BookingStepId,
} from "@/lib/visit-booking";
import { clearWizard, loadWizard, saveWizard, type CodeSent, type WizardState } from "@/lib/wizard-storage";
import { StepProgress } from "./StepProgress";
import { WizardRecap } from "./WizardRecap";
import { UnavailableNotice } from "./UnavailableNotice";
import { StepServices } from "./StepServices";
import { StepLocation } from "./StepLocation";
import { StepProfessional } from "./StepProfessional";
import { StepDateTime } from "./StepDateTime";
import { StepDetails } from "./StepDetails";
import { StepVerify } from "./StepVerify";
import { ConfirmationPanel } from "./ConfirmationPanel";

interface BookingWizardProps {
  services: Service[];
  /** R510: the headings the services step groups under. */
  serviceCategories: ServiceCategory[];
  locations: Location[];
  /** R240: everyone, with the services they perform. */
  professionals: PublicProfessional[];
  preselectedServiceIds: string[];
  // R150: the branch a "Book at …" button was pressed on
  preselectedLocationId?: string;
  timezone: string;
  /** R290: how many days ahead the salon takes online bookings. */
  maxAdvanceDays: number;
  /** R440: false = no professional step, and no names anywhere in the flow. */
  customersChooseProfessional: boolean;
  locale: Locale;
  defaultLocale: string;
  messages: Messages;
  /** R410: framed by a salon's own website (the /embed pages). */
  embedded?: boolean;
}

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
  serviceCategories,
  locations,
  professionals: allProfessionals,
  preselectedServiceIds,
  preselectedLocationId,
  timezone,
  maxAdvanceDays,
  customersChooseProfessional,
  locale,
  defaultLocale,
  messages,
  embedded = false,
}: BookingWizardProps) {
  const t = useMemo(() => translator(messages), [messages]);
  const text = useCallback(
    (plain: string, i18n: unknown) => localized(plain, i18n, locale, defaultLocale),
    [locale, defaultLocale],
  );

  // R440: only the steps with something to choose, for what's been picked so far
  const stepsFor = useCallback(
    (picked: Pick<BookingDraft, "serviceIds" | "locationId">): BookingStepId[] =>
      bookingSteps({
        services,
        professionals: allProfessionals,
        serviceIds: picked.serviceIds,
        locationId: picked.locationId,
        chooseLocation: locations.length > 1 && !preselectedLocationId,
        customersChooseProfessional,
      }),
    [services, allProfessionals, locations.length, preselectedLocationId, customersChooseProfessional],
  );

  // R160: "book another" starts over in the language being read
  const bookHref = useLocaleHref()("/book");

  const [stepIndex, setStepIndex] = useState(0);
  // Bumped when a saved draft is put back, so the service step starts over from
  // it (R510: the categories holding its services open).
  const [restoreCount, setRestoreCount] = useState(0);
  const [draft, setDraft] = useState<BookingDraft>(() => {
    // A deep link can't preselect something that can't be booked (R240/R210).
    // R440: with only one service to book, it's chosen already.
    const only = onlyBookableService(services, allProfessionals);
    const serviceIds = only
      ? [only]
      : preselectedServiceIds.filter((id) => isBookable(allProfessionals, id)).slice(0, MAX_SERVICES_PER_BOOKING);
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
  // R490: the API refused because the salon is paused — the page was rendered
  // from a cached copy that didn't know yet. Shown instead of the flow.
  const [paused, setPaused] = useState(false);
  // R250: the picked time went to someone else — say so and refresh the times
  const [slotTaken, setSlotTaken] = useState(false);
  const [slotsVersion, setSlotsVersion] = useState(0);
  // Each pick (or clear) supersedes the one before: a hold that comes back for a
  // pick that's no longer current is released rather than applied.
  const holdRequest = useRef(0);

  const steps = useMemo(
    () => stepsFor({ serviceIds: draft.serviceIds, locationId: draft.locationId }),
    [stepsFor, draft.serviceIds, draft.locationId],
  );
  const step = steps[stepIndex] ?? steps[0] ?? "time";

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
    setRestoreCount((count) => count + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveWizard({ stepIndex, stepId: step, draft, details, codeSent, confirmation });
  }, [stepIndex, step, draft, details, codeSent, confirmation]);

  /** A saved state that still fits this page's services, branches and staff — anything off, and it's dropped. */
  function restorable(saved: WizardState): WizardState | null {
    const shaped = Array.isArray(saved.draft.serviceIds) && Array.isArray(saved.draft.professionalIds);
    if (!shaped) return null;
    let d = saved.draft;
    // R440: a choice the business has since turned off is dropped — "any" instead;
    // and with one service left to book, it's the one booked.
    if (!customersChooseProfessional) d = { ...d, professionalIds: d.professionalIds.map(() => null) };
    const only = onlyBookableService(services, allProfessionals);
    if (only && d.serviceIds.length === 0) d = { ...d, serviceIds: [only], professionalIds: [null] };
    // The restored draft's steps, which can differ from this render's.
    const steps = stepsFor(d);
    const fits =
      d.serviceIds.length <= MAX_SERVICES_PER_BOOKING &&
      d.serviceIds.every((id) => services.some((service) => service.id === id) && isBookable(allProfessionals, id)) &&
      d.professionalIds.length === d.serviceIds.length &&
      d.professionalIds.every((id) => id === null || allProfessionals.some((p) => p.id === id)) &&
      (d.locationId === null || locations.some((location) => location.id === d.locationId)) &&
      Number.isInteger(saved.stepIndex) &&
      saved.stepIndex >= 0 &&
      (saved.stepId !== undefined || saved.stepIndex < steps.length);
    if (!fits) return null;

    const timeStep = steps.indexOf("time");
    const detailsStep = steps.indexOf("details");
    // By step, not position: the restored flow can have dropped (or gained) a
    // step before it. A step no longer offered starts the flow over.
    const savedStep = saved.stepId === undefined ? saved.stepIndex : steps.indexOf(saved.stepId);
    let stepIndex = Math.max(savedStep, 0);
    let draft = d;
    // A day that has gone by: back to picking a time, from today.
    if (draft.date < todayInTimezone(timezone)) {
      draft = { ...draft, date: todayInTimezone(timezone), slot: null, hold: null };
    }
    if (!draft.slot) stepIndex = Math.min(stepIndex, timeStep);
    if (!saved.details) stepIndex = Math.min(stepIndex, detailsStep);
    return { ...saved, stepIndex, draft };
  }

  // Only the professional step uses the branch's staff; R440 can leave it out.
  const offersProfessionalStep = steps.includes("professional");
  useEffect(() => {
    if (!offersProfessionalStep) return;
    let cancelled = false;
    setProfessionals(null);
    void fetchProfessionals(draft.locationId ?? undefined).then((result) => {
      if (cancelled) return;
      setProfessionals(result.ok ? result.professionals : []);
    });
    return () => {
      cancelled = true;
    };
  }, [draft.locationId, offersProfessionalStep]);

  const selectedServices = useMemo(
    () => draft.serviceIds.map((id) => services.find((service) => service.id === id)).filter((s): s is Service => !!s),
    [draft.serviceIds, services],
  );
  const selectedLocation = locations.find((location) => location.id === draft.locationId) ?? null;

  // R160: names resolved once, so every step and the confirmation say the same thing
  const professionalName = useCallback(
    (id: string | null) => {
      // R440: a business that books services, not people, never names anyone
      if (!customersChooseProfessional) return null;
      const professional = allProfessionals.find((candidate) => candidate.id === id);
      return professional ? text(professional.name, professional.nameI18n) : null;
    },
    [allProfessionals, text, customersChooseProfessional],
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
    } else if (result.reason === "paused") {
      setPaused(true);
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
      if (result.reason === "paused") {
        setPaused(true);
        return;
      }
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
    // R410: lets the salon's own page react (say, thank the customer). No manage link: it is a credential.
    if (embedded) postToHost({ type: "booking-widget:booked", startAt: result.visit.startAt });
  };

  if (paused) {
    return <UnavailableNotice heading={t("booking.pausedHeading")} body={t("booking.pausedBody")} />;
  }

  if (confirmation) {
    return (
      <ConfirmationPanel
        confirmation={confirmation}
        timezone={timezone}
        locale={locale}
        t={t}
        text={text}
        // R410: the manage page belongs in its own tab, not inside the salon's site
        manageInNewTab={embedded}
        showProfessionals={customersChooseProfessional}
        onBookAnother={() => {
          // A clean start: no saved progress, no deep-link preselection.
          clearWizard();
          // Embedded, start over on this same embed page (keeping only whether it
          // is the overlay); otherwise on the booking page.
          if (embedded) {
            const overlay = new URLSearchParams(window.location.search).get("overlay");
            window.location.assign(window.location.pathname + (overlay ? `?overlay=${encodeURIComponent(overlay)}` : ""));
          } else {
            window.location.assign(bookHref);
          }
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-sm font-bold">{t("booking.title")}</h1>
      <StepProgress
        steps={steps.map((id) => t(`booking.steps.${id}`))}
        current={stepIndex}
        label={t("booking.stepOf", { current: stepIndex + 1, total: steps.length })}
        onSelect={setStepIndex}
      />

      {/* What's been picked so far. The details step shows the full summary instead. */}
      {/* R440: also on a first step when the service was picked for the customer. */}
      {step !== "services" && step !== "details" && (
        <WizardRecap
          label={t("booking.summary.heading")}
          items={[
            selectedServices.map((service) => text(service.name, service.nameI18n)).join(", "),
            locations.length > 1 && selectedLocation ? text(selectedLocation.name, selectedLocation.nameI18n) : "",
            draft.slot && stepIndex > steps.indexOf("time") ? formatInstant(draft.slot.startAt, timezone, locale) : "",
          ].filter((item) => item !== "")}
        />
      )}

      {submitError === "conflict" && (
        <div className="alert alert-soft alert-warning" role="alert">
          {t("booking.details.slotTaken")}
        </div>
      )}

      {step === "services" && (
        <StepServices
          key={restoreCount}
          services={services}
          categories={serviceCategories}
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
          onBack={stepIndex > 0 ? goBack : undefined}
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
          onBack={stepIndex > 0 ? goBack : undefined}
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
          onBack={stepIndex > 0 ? goBack : undefined}
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
          isBooking={isSubmitting}
          bookingError={submitError === "conflict" ? null : submitError}
          onBack={goBack}
          t={t}
        />
      )}
    </div>
  );
}
