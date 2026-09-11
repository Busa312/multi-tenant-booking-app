import {
  addDaysToDateString,
  dayOfWeekForDateString,
  isValidTimezone,
  parseDateOnly,
  parseTimeOfDay,
  zonedDateString,
  zonedParts,
  zonedTimeToUtc,
} from "./timezone.js";

const TBILISI = "Asia/Tbilisi";
const NEW_YORK = "America/New_York";
const KATHMANDU = "Asia/Kathmandu";

describe("parseDateOnly", () => {
  it("splits a YYYY-MM-DD string into calendar fields", () => {
    expect(parseDateOnly("2026-08-05")).toEqual({ year: 2026, month: 8, day: 5 });
  });

  it.each(["2026-8-05", "26-08-05", "2026/08/05", "2026-08-05T00:00:00Z", "", "not-a-date"])(
    "rejects %p",
    (input) => {
      expect(() => parseDateOnly(input)).toThrow(RangeError);
    },
  );
});

describe("parseTimeOfDay", () => {
  it("returns minutes from midnight", () => {
    expect(parseTimeOfDay("00:00")).toBe(0);
    expect(parseTimeOfDay("09:30")).toBe(570);
    expect(parseTimeOfDay("23:59")).toBe(1439);
  });

  it("accepts an optional seconds component without letting it change the result", () => {
    expect(parseTimeOfDay("09:30:45")).toBe(570);
  });

  it.each(["9:30", "0930", "24:00", "23:60", "", "09:30 PM"])("rejects %p", (input) => {
    expect(() => parseTimeOfDay(input)).toThrow(RangeError);
  });
});

describe("zonedParts", () => {
  it("reads an instant as wall-clock in the given zone", () => {
    expect(zonedParts(new Date("2026-08-05T05:00:00Z"), TBILISI)).toEqual({
      year: 2026,
      month: 8,
      day: 5,
      hour: 9,
      minute: 0,
      second: 0,
    });
  });

  it("uses a 24-hour clock rather than wrapping midnight to 24", () => {
    expect(zonedParts(new Date("2026-08-05T20:00:00Z"), TBILISI)).toMatchObject({ day: 6, hour: 0 });
  });
});

describe("zonedTimeToUtc", () => {
  it("resolves a wall-clock reading against a fixed-offset zone", () => {
    expect(zonedTimeToUtc("2026-08-05", 9 * 60, TBILISI).toISOString()).toBe("2026-08-05T05:00:00.000Z");
  });

  it("handles a zone whose offset is not a whole number of hours", () => {
    expect(zonedTimeToUtc("2026-08-05", 9 * 60, KATHMANDU).toISOString()).toBe("2026-08-05T03:15:00.000Z");
  });

  it("uses the offset in effect before a spring-forward transition", () => {
    expect(zonedTimeToUtc("2026-03-08", 90, NEW_YORK).toISOString()).toBe("2026-03-08T06:30:00.000Z");
  });

  it("uses the offset in effect after a spring-forward transition", () => {
    expect(zonedTimeToUtc("2026-03-08", 210, NEW_YORK).toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("resolves a clock reading that DST skips onto a real instant", () => {
    const resolved = zonedTimeToUtc("2026-03-08", 150, NEW_YORK);
    expect(resolved.toISOString()).toBe("2026-03-08T06:30:00.000Z");
    expect(zonedParts(resolved, NEW_YORK)).toMatchObject({ day: 8, hour: 1, minute: 30 });
  });

  it("picks the first occurrence of a clock reading DST repeats", () => {
    expect(zonedTimeToUtc("2026-11-01", 90, NEW_YORK).toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("round-trips every whole hour of a spring-forward day back to the same date", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const instant = zonedTimeToUtc("2026-03-08", hour * 60, NEW_YORK);
      expect(zonedDateString(instant, NEW_YORK)).toBe("2026-03-08");
    }
  });

  it("throws through parseDateOnly on a malformed date", () => {
    expect(() => zonedTimeToUtc("08/05/2026", 0, TBILISI)).toThrow(RangeError);
  });
});

describe("zonedDateString", () => {
  it("returns the tenant-local calendar date, not the UTC one", () => {
    expect(zonedDateString(new Date("2026-08-05T20:00:00Z"), TBILISI)).toBe("2026-08-06");
    expect(zonedDateString(new Date("2026-08-05T20:00:00Z"), NEW_YORK)).toBe("2026-08-05");
  });

  it("zero-pads month and day", () => {
    expect(zonedDateString(new Date("2026-01-02T12:00:00Z"), TBILISI)).toBe("2026-01-02");
  });
});

describe("addDaysToDateString", () => {
  it("rolls forward over a month boundary", () => {
    expect(addDaysToDateString("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("rolls forward over a leap day", () => {
    expect(addDaysToDateString("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("rolls backward over a year boundary", () => {
    expect(addDaysToDateString("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("returns the same date for a zero shift", () => {
    expect(addDaysToDateString("2026-08-05", 0)).toBe("2026-08-05");
  });
});

describe("dayOfWeekForDateString", () => {
  it("uses BusinessHours' numbering, 0 = Sunday", () => {
    expect(dayOfWeekForDateString("2026-08-02")).toBe(0);
    expect(dayOfWeekForDateString("2026-08-05")).toBe(3);
    expect(dayOfWeekForDateString("2026-08-08")).toBe(6);
  });
});

describe("isValidTimezone", () => {
  it("accepts IANA zones, including legacy aliases", () => {
    expect(isValidTimezone("Asia/Tbilisi")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);

    expect(isValidTimezone("Asia/Calcutta")).toBe(true);
  });

  it("rejects a reversed zone — the typo that motivated this guard", () => {
    expect(isValidTimezone("tbilisi/asia")).toBe(false);
  });

  it("rejects blanks and non-strings without throwing", () => {
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("   ")).toBe(false);
    expect(isValidTimezone(undefined)).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
    expect(isValidTimezone(42)).toBe(false);
  });
});
