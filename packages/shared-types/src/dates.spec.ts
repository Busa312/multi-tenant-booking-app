import { DATE_NAMES, georgianDate } from "./dates";

const nov18 = { year: 2026, month: 10, day: 18, weekday: 3 };

describe("date names", () => {
  it("has every weekday and month in each language", () => {
    for (const names of Object.values(DATE_NAMES)) {
      expect(names.weekdays).toHaveLength(7);
      expect(names.weekdaysShort).toHaveLength(7);
      expect(names.months).toHaveLength(12);
      expect(names.monthsShort).toHaveLength(12);
    }
  });
});

// R570: the booking site's day picker in Russian — day before the month, in the form that follows a number
describe("Russian date names", () => {
  it("writes a day as Russian does", () => {
    const ru = DATE_NAMES.ru;
    expect(ru.day({ weekday: ru.weekdaysShort[3] ?? "", day: 18, month: ru.monthsShort[10] ?? "" })).toBe("Ср, 18 нояб.");
    expect(ru.monthsShort[4]).toBe("мая");
  });
});

// The CMS in Georgian, where browsers have no Georgian date data
describe("georgianDate", () => {
  it("writes dates the Georgian way: day before month", () => {
    expect(georgianDate.long(nov18)).toBe("ოთხშაბათი, 18 ნოემბერი");
    expect(georgianDate.withYear(nov18)).toBe("18 ნოემბერი, 2026");
    expect(georgianDate.month(nov18)).toBe("ნოემბერი, 2026");
    expect(georgianDate.short(nov18)).toBe("18 ნოე. 2026");
  });

  it("writes a week inside one month, and across two", () => {
    expect(georgianDate.range({ ...nov18, day: 16 }, { ...nov18, day: 22 })).toBe("16–22 ნოემბერი");
    expect(georgianDate.range({ ...nov18, day: 30 }, { year: 2026, month: 11, day: 6, weekday: 0 })).toBe("30 ნოემბერი – 6 დეკემბერი");
  });
});
