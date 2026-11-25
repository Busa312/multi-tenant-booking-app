import { inQuietHours, reminderDueAt, reminderVerdict } from "./reminder-schedule.js";

// R610: when a reminder goes out
const TBILISI = "Asia/Tbilisi"; // UTC+4, no DST
const BERLIN = "Europe/Berlin"; // DST: 29 March 2026 02:00 → 03:00

const at = (iso: string) => new Date(iso);

describe("reminderDueAt", () => {
  it("is the setting's hours before the start", () => {
    // 15:00 Tbilisi, 24 h ahead → 15:00 the day before
    expect(reminderDueAt(at("2026-11-26T11:00:00Z"), 24, TBILISI)).toEqual(at("2026-11-25T11:00:00Z"));
    // 15:00, 2 h ahead → 13:00
    expect(reminderDueAt(at("2026-11-26T11:00:00Z"), 2, TBILISI)).toEqual(at("2026-11-26T09:00:00Z"));
  });

  it("is never: reminders are off", () => {
    expect(reminderDueAt(at("2026-11-26T11:00:00Z"), 0, TBILISI)).toBeNull();
  });

  it("moves a reminder due in the late evening to 20:00 that evening", () => {
    // 23:30 visit, 2 h ahead → due 21:30 → 20:00
    expect(reminderDueAt(at("2026-11-26T19:30:00Z"), 2, TBILISI)).toEqual(at("2026-11-26T16:00:00Z"));
  });

  it("moves a reminder due in the small hours to 20:00 the evening before", () => {
    // 10:00 visit, 2 h ahead → due 08:00 → 20:00 the previous day
    expect(reminderDueAt(at("2026-11-26T06:00:00Z"), 2, TBILISI)).toEqual(at("2026-11-25T16:00:00Z"));
    // 07:00 visit, 24 h ahead → due 07:00 the day before → 20:00 two evenings before
    expect(reminderDueAt(at("2026-11-26T03:00:00Z"), 24, TBILISI)).toEqual(at("2026-11-24T16:00:00Z"));
  });

  it("keeps the edges: 09:00 is day, 21:00 is night", () => {
    // due exactly 09:00 → stays
    expect(reminderDueAt(at("2026-11-26T07:00:00Z"), 2, TBILISI)).toEqual(at("2026-11-26T05:00:00Z"));
    // due exactly 21:00 → 20:00
    expect(reminderDueAt(at("2026-11-26T19:00:00Z"), 2, TBILISI)).toEqual(at("2026-11-26T16:00:00Z"));
  });

  it("finds 20:00 local across a DST change", () => {
    // Monday 30 March 09:00 CEST (07:00Z), 48 h ahead → Saturday 08:00 CET, before 09:00
    // → 20:00 CET on Friday 27 March = 19:00Z
    expect(reminderDueAt(at("2026-03-30T07:00:00Z"), 48, BERLIN)).toEqual(at("2026-03-27T19:00:00Z"));
    // Sunday 29 March 08:30 CEST (06:30Z), 2 h ahead → 04:30Z = 06:30 CEST, the morning of the
    // change → 20:00 CET on Saturday = 19:00Z
    expect(reminderDueAt(at("2026-03-29T06:30:00Z"), 2, BERLIN)).toEqual(at("2026-03-28T19:00:00Z"));
  });
});

describe("inQuietHours", () => {
  it("is 21:00 to 09:00 salon time", () => {
    expect(inQuietHours(at("2026-11-26T16:59:00Z"), TBILISI)).toBe(false); // 20:59
    expect(inQuietHours(at("2026-11-26T17:00:00Z"), TBILISI)).toBe(true); // 21:00
    expect(inQuietHours(at("2026-11-26T04:59:00Z"), TBILISI)).toBe(true); // 08:59
    expect(inQuietHours(at("2026-11-26T05:00:00Z"), TBILISI)).toBe(false); // 09:00
  });
});

describe("reminderVerdict", () => {
  const start = at("2026-11-26T11:00:00Z"); // 15:00 Tbilisi; 24 h reminder due 25 Nov 15:00
  const booked = at("2026-11-20T10:00:00Z");

  it("sends once due", () => {
    expect(reminderVerdict({ startAt: start, createdAt: booked }, 24, TBILISI, at("2026-11-25T11:00:00Z"))).toBe("send");
    expect(reminderVerdict({ startAt: start, createdAt: booked }, 24, TBILISI, at("2026-11-25T15:00:00Z"))).toBe("send");
  });

  it("waits until due", () => {
    expect(reminderVerdict({ startAt: start, createdAt: booked }, 24, TBILISI, at("2026-11-25T10:59:00Z"))).toBe("wait");
  });

  it("waits through the night — a late retry goes out in the morning", () => {
    expect(reminderVerdict({ startAt: start, createdAt: booked }, 24, TBILISI, at("2026-11-25T18:00:00Z"))).toBe("wait"); // 22:00
    expect(reminderVerdict({ startAt: start, createdAt: booked }, 24, TBILISI, at("2026-11-26T05:00:00Z"))).toBe("send"); // 09:00
  });

  it("skips a booking made after its reminder time: they just booked", () => {
    const justBooked = at("2026-11-25T12:00:00Z");
    expect(reminderVerdict({ startAt: start, createdAt: justBooked }, 24, TBILISI, at("2026-11-25T12:05:00Z"))).toBe("skip");
  });

  it("skips one that already started, and every booking while reminders are off", () => {
    expect(reminderVerdict({ startAt: start, createdAt: booked }, 24, TBILISI, start)).toBe("skip");
    expect(reminderVerdict({ startAt: start, createdAt: booked }, 0, TBILISI, at("2026-11-25T12:00:00Z"))).toBe("skip");
  });
});
