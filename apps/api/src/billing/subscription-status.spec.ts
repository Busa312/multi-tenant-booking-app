import { deriveStatus, nextPeriodStart, renewalDue, type StatusFacts } from "./subscription-status.js";

const DAY = 86_400_000;
const GRACE = 7 * DAY;
const now = new Date("2026-11-17T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * DAY);
const facts = (overrides: Partial<StatusFacts> = {}): StatusFacts => ({
  free: false,
  trialEndsAt: days(5),
  paidThrough: null,
  cancelAtPeriodEnd: false,
  ...overrides,
});

// R480: status is derived from facts, never stored
describe("deriveStatus", () => {
  it("is a trial until the trial ends", () => {
    expect(deriveStatus(facts(), now, GRACE)).toMatchObject({ status: "trial", bookingPaused: false, accessUntil: days(5) });
  });

  it("is active as soon as a month is paid — even during the trial", () => {
    expect(deriveStatus(facts({ paidThrough: days(35) }), now, GRACE)).toMatchObject({ status: "active", accessUntil: days(35) });
  });

  it("gives 7 days' grace after an unpaid trial, then pauses booking (R490)", () => {
    expect(deriveStatus(facts({ trialEndsAt: days(-2) }), now, GRACE)).toMatchObject({
      status: "past_due",
      graceEndsAt: days(5),
      bookingPaused: false,
    });
    expect(deriveStatus(facts({ trialEndsAt: days(-8) }), now, GRACE)).toMatchObject({ status: "lapsed", bookingPaused: true });
  });

  it("gives the same grace after a paid month that wasn't renewed", () => {
    expect(deriveStatus(facts({ trialEndsAt: days(-40), paidThrough: days(-1) }), now, GRACE).status).toBe("past_due");
    expect(deriveStatus(facts({ trialEndsAt: days(-40), paidThrough: days(-7) }), now, GRACE).status).toBe("lapsed");
  });

  it("has no grace for a cancelled subscription: it lapses when the paid month ends", () => {
    const cancelled = facts({ trialEndsAt: days(-40), cancelAtPeriodEnd: true });
    expect(deriveStatus({ ...cancelled, paidThrough: days(3) }, now, GRACE).status).toBe("active");
    expect(deriveStatus({ ...cancelled, paidThrough: days(-1) }, now, GRACE)).toMatchObject({ status: "lapsed", bookingPaused: true });
  });

  it("never pauses a salon on free use", () => {
    expect(deriveStatus(facts({ free: true, trialEndsAt: days(-400) }), now, GRACE)).toMatchObject({ status: "free", bookingPaused: false });
  });
});

// R470
describe("renewalDue", () => {
  const paying = { ...facts({ trialEndsAt: days(-40), paidThrough: days(-1) }), rectoken: "tok", retryAt: null };

  it("charges once the paid month has ended, within the grace period", () => {
    expect(renewalDue(paying, now, GRACE)).toBe(true);
    expect(renewalDue({ ...paying, paidThrough: days(1) }, now, GRACE)).toBe(false);
    expect(renewalDue({ ...paying, paidThrough: days(-8) }, now, GRACE)).toBe(false);
  });

  it("waits for the retry time after a failure (or a renewal in flight)", () => {
    expect(renewalDue({ ...paying, retryAt: days(0.5) }, now, GRACE)).toBe(false);
    expect(renewalDue({ ...paying, retryAt: days(-0.1) }, now, GRACE)).toBe(true);
  });

  it("never charges without a card, after cancelling, or on free use", () => {
    expect(renewalDue({ ...paying, rectoken: null }, now, GRACE)).toBe(false);
    expect(renewalDue({ ...paying, cancelAtPeriodEnd: true }, now, GRACE)).toBe(false);
    expect(renewalDue({ ...paying, free: true }, now, GRACE)).toBe(false);
  });
});

describe("nextPeriodStart", () => {
  it("keeps the remaining trial days, and pays for the grace days already used", () => {
    expect(nextPeriodStart(deriveStatus(facts(), now, GRACE), now)).toEqual(days(5));
    expect(nextPeriodStart(deriveStatus(facts({ trialEndsAt: days(-2) }), now, GRACE), now)).toEqual(days(-2));
  });

  it("starts now for a salon that had lapsed", () => {
    expect(nextPeriodStart(deriveStatus(facts({ trialEndsAt: days(-30) }), now, GRACE), now)).toEqual(now);
  });
});
