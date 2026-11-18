import { extraTexts, usageWindow } from "./sms-usage.js";
import type { DerivedStatus } from "./subscription-status.js";

const now = new Date("2026-11-17T12:00:00Z");
const at = (iso: string) => new Date(iso);
const derived = (status: DerivedStatus["status"]): DerivedStatus => ({ status, accessUntil: now, graceEndsAt: null, bookingPaused: status === "lapsed" });
const base = { cancelAtPeriodEnd: false, now, cycle: { kind: "month" } as const, timeZone: "Asia/Tbilisi" };

// R500
describe("usageWindow", () => {
  it("is the paid month while one runs, charged at the renewal that ends it", () => {
    expect(
      usageWindow({ ...base, derived: derived("active"), paidThrough: at("2026-12-05T09:00:00Z"), currentPeriodStart: at("2026-11-05T09:00:00Z") }),
    ).toEqual({ start: at("2026-11-05T09:00:00Z"), end: at("2026-12-05T09:00:00Z"), kind: "billing", billable: true });
  });

  it("is the month the overdue renewal will buy while it's past due, so no text falls between months", () => {
    expect(
      usageWindow({ ...base, derived: derived("past_due"), paidThrough: at("2026-11-15T09:00:00Z"), currentPeriodStart: at("2026-10-15T09:00:00Z") }),
    ).toEqual({ start: at("2026-11-15T09:00:00Z"), end: at("2026-12-15T09:00:00Z"), kind: "billing", billable: true });
  });

  it("charges nothing in the last month of a cancelled subscription — no renewal follows it", () => {
    const window = usageWindow({
      ...base,
      cancelAtPeriodEnd: true,
      derived: derived("active"),
      paidThrough: at("2026-12-05T09:00:00Z"),
      currentPeriodStart: at("2026-11-05T09:00:00Z"),
    });
    expect(window).toMatchObject({ kind: "billing", billable: false });
  });

  it("is the free calendar month in a trial — even one already paid for from its end", () => {
    const calendar = { start: at("2026-10-31T20:00:00Z"), end: at("2026-11-30T20:00:00Z"), kind: "calendar", billable: false };
    expect(usageWindow({ ...base, derived: derived("trial"), paidThrough: null, currentPeriodStart: null })).toEqual(calendar);
    expect(
      usageWindow({ ...base, derived: derived("active"), paidThrough: at("2026-12-25T09:00:00Z"), currentPeriodStart: at("2026-11-25T09:00:00Z") }),
    ).toEqual(calendar);
  });

  it("is the free calendar month on free use and once lapsed", () => {
    expect(usageWindow({ ...base, derived: derived("free"), paidThrough: null, currentPeriodStart: null }).billable).toBe(false);
    expect(usageWindow({ ...base, derived: derived("lapsed"), paidThrough: at("2026-10-01T00:00:00Z"), currentPeriodStart: null }).kind).toBe("calendar");
  });
});

describe("extraTexts", () => {
  it("prices texts beyond the allowance at 0.07 ₾ each, exactly", () => {
    expect(extraTexts(620, 600)).toEqual({ count: 20, tetri: 140, amount: "1.40" });
    expect(extraTexts(601, 600)).toEqual({ count: 1, tetri: 7, amount: "0.07" });
    expect(extraTexts(3, 600)).toEqual({ count: 0, tetri: 0, amount: "0.00" });
  });
});
