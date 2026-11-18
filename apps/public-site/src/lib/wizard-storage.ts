import type { BookingDraft, Confirmation, CustomerDetails } from "@/components/BookingWizard";
import type { BookingStepId } from "@/lib/visit-booking";

/** A verification code already sent to a number — coming back to the step reuses it rather than sending another. */
export interface CodeSent {
  phoneNumber: string;
  /** Epoch ms — the resend cooldown counts from here. */
  sentAt: number;
  expiresAt: string;
  devCode: string | null;
}

export interface WizardState {
  stepIndex: number;
  /**
   * The step itself (R440): the flow leaves out steps with nothing to choose,
   * so the same index can mean another step by the time it's restored.
   */
  stepId?: BookingStepId;
  draft: BookingDraft;
  details: CustomerDetails | null;
  codeSent: CodeSent | null;
  confirmation: Confirmation | null;
}

interface Saved {
  v: 1;
  /** The query string the wizard was opened with — a different deep link starts fresh. */
  search: string;
  savedAt: number;
  state: WizardState;
}

const KEY = "booking-wizard";
// Long enough to survive a language switch, a reload or a phone call; short
// enough that a returning visitor isn't dropped into yesterday's half-booking.
const MAX_AGE_MS = 30 * 60_000;

/**
 * The booking wizard's progress, per browser tab. Switching language re-renders
 * the page under another locale segment (/en/book → /ka/book), which mounts the
 * wizard afresh — without this, every switch threw the customer back to step 1.
 *
 * Every access is guarded: storage can be missing or throw (private windows,
 * blocked site data), and then the wizard simply starts at the beginning.
 */
export function loadWizard(): WizardState | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Saved>;
    if (saved.v !== 1 || !saved.state || typeof saved.savedAt !== "number") return null;
    if (saved.search !== window.location.search) return null;
    if (Date.now() - saved.savedAt > MAX_AGE_MS) return null;
    return saved.state;
  } catch {
    return null;
  }
}

export function saveWizard(state: WizardState): void {
  try {
    const saved: Saved = { v: 1, search: window.location.search, savedAt: Date.now(), state };
    window.sessionStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Not saved — a language switch will start over, nothing worse.
  }
}

/**
 * `/book`, `/ka/book`, `/embed/full`, `/ka/embed/full` (a trailing slash
 * allowed). A pattern rather than the locale list: that module carries every
 * message catalog, too much to put on every page for this.
 */
const BOOKING_PATH = /^(\/[a-z]{2}(-[A-Za-z]{2,4})?)?\/(book|embed\/full)\/?$/;

/**
 * R160: whether `pathname` (as the browser shows it, with or without a language
 * prefix) is the booking flow itself — the only pages its saved progress is for.
 */
export function isBookingPath(pathname: string): boolean {
  return BOOKING_PATH.test(pathname);
}

export function clearWizard(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
