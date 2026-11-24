import { bookingAlertPayload, firstName, formatVisitTime, toPushLocale, type BookingAlert } from "./push-templates.js";

// R620: what staff read on their lock screen

const alert = (overrides: Partial<BookingAlert> = {}): BookingAlert => ({
  kind: "booked",
  visitId: "v1",
  customerName: "Nino Beridze",
  serviceName: "Haircut",
  serviceNameI18n: { ka: "თმის შეჭრა", ru: "Стрижка" },
  moreServices: 0,
  // 11:45 in Tbilisi (UTC+4)
  startAt: new Date("2026-11-24T07:45:00.000Z"),
  timezone: "Asia/Tbilisi",
  ...overrides,
});

describe("bookingAlertPayload", () => {
  it("names what happened, who, what and when — in the salon's time zone", () => {
    expect(bookingAlertPayload(alert(), "en")).toEqual({
      title: "New booking",
      body: "Nino · Haircut · Tue, Nov 24 11:45",
      tag: "visit-v1",
      url: "/bookings?date=2026-11-24",
    });
  });

  it("is written in the device's language, service name included (R160, R570)", () => {
    expect(bookingAlertPayload(alert({ kind: "cancelled" }), "ka")).toMatchObject({
      title: "ჯავშანი გაუქმდა",
      body: "Nino · თმის შეჭრა · სამ, 24 ნოე 11:45",
    });
    expect(bookingAlertPayload(alert({ kind: "rescheduled" }), "ru")).toMatchObject({
      title: "Запись перенесена",
      body: "Nino · Стрижка · Вт, 24 нояб. 11:45",
    });
  });

  it("falls back to the default name when there's no translation", () => {
    expect(bookingAlertPayload(alert({ serviceNameI18n: null }), "ru").body).toContain("Haircut");
  });

  it("counts the other services instead of listing them", () => {
    expect(bookingAlertPayload(alert({ moreServices: 2 }), "en").body).toContain("Haircut +2");
  });

  it("links to the salon-local day, even when it differs from the UTC one", () => {
    // 01:30 on the 25th in Tbilisi is still the 24th in UTC
    const late = alert({ startAt: new Date("2026-11-24T21:30:00.000Z") });
    expect(bookingAlertPayload(late, "en").url).toBe("/bookings?date=2026-11-25");
  });

  it("keeps one notification per visit, so a later change replaces the earlier one", () => {
    expect(bookingAlertPayload(alert({ kind: "booked" }), "en").tag).toBe(
      bookingAlertPayload(alert({ kind: "cancelled" }), "ka").tag,
    );
  });
});

describe("helpers", () => {
  it("shows only the first name", () => {
    expect(firstName("  Nino   Beridze ")).toBe("Nino");
    expect(firstName("")).toBe("");
  });

  it("pads the time", () => {
    expect(formatVisitTime(new Date("2026-01-05T05:05:00.000Z"), "Asia/Tbilisi", "en")).toBe("Mon, Jan 5 09:05");
  });

  it("reads anything unknown as Georgian", () => {
    expect(toPushLocale("en")).toBe("en");
    expect(toPushLocale("ru")).toBe("ru");
    expect(toPushLocale("de")).toBe("ka");
    expect(toPushLocale(undefined)).toBe("ka");
  });
});
