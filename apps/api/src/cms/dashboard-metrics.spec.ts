import { Prisma } from "../../generated/prisma/index.js";
import { summarizeDay, summarizePeriod, uncoveredMs, type PeriodAppointmentRow } from "./dashboard-metrics.js";

const TZ = "Asia/Tbilisi"; // UTC+4, no DST
const MIN = 60_000;
const at = (iso: string) => new Date(iso);
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

// R370
describe("uncoveredMs", () => {
  const window = { start: at("2026-11-12T06:00:00Z"), end: at("2026-11-12T14:00:00Z") };

  it("subtracts overlapping blocks once, and ignores blocks outside the window", () => {
    const blocks = [
      { start: at("2026-11-12T08:00:00Z"), end: at("2026-11-12T10:00:00Z") },
      { start: at("2026-11-12T09:00:00Z"), end: at("2026-11-12T11:00:00Z") }, // overlaps the first
      { start: at("2026-11-12T20:00:00Z"), end: at("2026-11-12T21:00:00Z") }, // outside
    ];
    expect(uncoveredMs(window, blocks)).toBe(5 * 60 * MIN);
  });

  it("is zero when a block covers the whole window", () => {
    expect(uncoveredMs(window, [{ start: at("2026-11-11T00:00:00Z"), end: at("2026-11-13T00:00:00Z") }])).toBe(0);
  });
});

// R370
describe("summarizeDay", () => {
  const base = {
    date: "2026-11-12", // a Thursday
    timezone: TZ,
    // tenant default 10:00–18:00 (8 h); Nina has her own 12:00–16:00 (4 h)
    businessHours: [
      { professionalId: null, startTime: time("10:00"), endTime: time("18:00") },
      { professionalId: "nina", startTime: time("12:00"), endTime: time("16:00") },
    ],
    timeOff: [],
    appointments: [],
  };

  it("adds each professional's own hours, falling back to the tenant's", () => {
    const day = summarizeDay({ ...base, professionalIds: ["dato", "nina"] });
    expect(day.workingMinutes).toBe(8 * 60 + 4 * 60);
  });

  it("takes personal and business-wide time off out of working minutes", () => {
    const day = summarizeDay({
      ...base,
      professionalIds: ["dato", "nina"],
      timeOff: [
        // Dato off 10:00–12:00 local
        { professionalId: "dato", startAt: at("2026-11-12T06:00:00Z"), endAt: at("2026-11-12T08:00:00Z") },
        // everyone off 15:00–16:00 local
        { professionalId: null, startAt: at("2026-11-12T11:00:00Z"), endAt: at("2026-11-12T12:00:00Z") },
      ],
    });
    expect(day.workingMinutes).toBe(8 * 60 - 120 - 60 + (4 * 60 - 60));
  });

  it("counts a split visit as one booking, and books minutes only for professionals in scope", () => {
    const day = summarizeDay({
      ...base,
      professionalIds: ["dato"],
      appointments: [
        { id: "a1", visitId: "v1", professionalId: "dato", startAt: at("2026-11-12T07:00:00Z"), endAt: at("2026-11-12T08:00:00Z") },
        { id: "a2", visitId: "v1", professionalId: "nina", startAt: at("2026-11-12T08:00:00Z"), endAt: at("2026-11-12T08:30:00Z") },
        { id: "a3", visitId: null, professionalId: null, startAt: at("2026-11-12T09:00:00Z"), endAt: at("2026-11-12T09:30:00Z") },
      ],
    });
    expect(day.bookings).toBe(2);
    expect(day.bookedMinutes).toBe(60);
  });
});

// R370
describe("summarizePeriod", () => {
  const PERIOD_START = at("2026-10-13T00:00:00Z");
  const row = (overrides: Partial<PeriodAppointmentRow>): PeriodAppointmentRow => ({
    id: "a",
    visitId: null,
    phoneNumber: "+995555000001",
    status: "completed",
    createdByUserId: null,
    price: new Prisma.Decimal("40.00"),
    ...overrides,
  });

  const rows = [
    row({ id: "a1", visitId: "v1", phoneNumber: "+995555000001", price: new Prisma.Decimal("40.10") }),
    row({ id: "a2", visitId: "v1", phoneNumber: "+995555000001", price: new Prisma.Decimal("20.20") }),
    row({ id: "a3", phoneNumber: "+995555000002", status: "no_show", createdByUserId: "staff-1" }),
    row({ id: "a4", phoneNumber: "+995555000003", status: "cancelled" }),
    row({ id: "a5", phoneNumber: "+995555000004", status: "booked", createdByUserId: "staff-1" }),
  ];
  const firstSeen = new Map([
    ["+995555000001", at("2026-01-01T00:00:00Z")], // been before: returning
    ["+995555000002", at("2026-10-20T00:00:00Z")], // first visit inside the period: new
    // +995555000004 has no history row at all: new
  ]);

  it("counts visits once and leaves cancelled rows out of bookings and clients", () => {
    const period = summarizePeriod(rows, firstSeen, PERIOD_START, true);
    expect(period).toMatchObject({
      bookings: 3,
      onlineBookings: 1,
      appointments: 5,
      completed: 2,
      noShows: 1,
      cancelled: 1,
      newClients: 2,
      returningClients: 1,
    });
  });

  it("sums completed prices as decimals, never floats", () => {
    expect(summarizePeriod(rows, firstSeen, PERIOD_START, true).completedValue).toBe("60.30");
  });

  it("never returns a money figure when the value is withheld (professional login)", () => {
    expect(summarizePeriod(rows, firstSeen, PERIOD_START, false).completedValue).toBeNull();
  });
});
