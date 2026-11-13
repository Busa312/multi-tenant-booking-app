import type { OnboardingStatus, OnboardingStepId } from "@booking/shared-types";

/** Remembers, for this browser session, that the setup has been opened (R420: it opens by itself once). */
const OPENED_KEY = "booking_cms_setup_opened";

export function setupOpenedThisSession(): boolean {
  try {
    return sessionStorage.getItem(OPENED_KEY) === "1";
  } catch {
    // Storage blocked: never redirect, rather than redirect every time.
    return true;
  }
}

export function markSetupOpened(): void {
  try {
    sessionStorage.setItem(OPENED_KEY, "1");
  } catch {
    // Nothing to remember it in; harmless.
  }
}

/** The step to show: the requested one, else the first neither done nor skipped, else the last. */
export function currentSetupStep(status: OnboardingStatus, requested: string | null): OnboardingStepId {
  const asked = status.steps.find((step) => step.id === requested);
  if (asked) return asked.id;
  const open = status.steps.find((step) => !step.done && !step.skipped);
  return open?.id ?? "live";
}

/** The step after `id`, or null after the last. */
export function nextSetupStep(status: OnboardingStatus, id: OnboardingStepId): OnboardingStepId | null {
  const index = status.steps.findIndex((step) => step.id === id);
  return status.steps[index + 1]?.id ?? null;
}

export const doneCount = (status: OnboardingStatus): number => status.steps.filter((step) => step.done).length;
