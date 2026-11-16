import { openingHours, workingWindows, type BusinessHoursRow } from "./working-hours.js";

const at = (clock: string) => new Date(`1970-01-01T${clock}:00.000Z`);
const row = (dayOfWeek: number, start: string, end: string, professionalId: string | null = null) => ({
  dayOfWeek,
  professionalId,
  startTime: at(start),
  endTime: at(end),
});

describe("workingWindows", () => {
  const day: BusinessHoursRow[] = [row(1, "10:00", "19:00"), row(1, "12:00", "16:00", "nina")];

  it("uses a professional's own hours when they have any, the salon's otherwise", () => {
    expect(workingWindows(day, "nina")).toEqual([{ startMinutes: 720, endMinutes: 960 }]);
    expect(workingWindows(day, "dato")).toEqual([{ startMinutes: 600, endMinutes: 1140 }]);
  });

  // R460
  describe("a professional's day off", () => {
    const dayOff = { ...row(1, "00:00", "00:00", "nina"), isDayOff: true };

    it("means no working time, even though the salon is open that day", () => {
      expect(workingWindows([row(1, "10:00", "19:00"), dayOff], "nina")).toEqual([]);
    });

    it("is nobody else's day off", () => {
      expect(workingWindows([row(1, "10:00", "19:00"), dayOff], "dato")).toEqual([{ startMinutes: 600, endMinutes: 1140 }]);
    });

    it("still means no working time to a caller that never read the flag", () => {
      const { isDayOff: _ignored, ...stored } = dayOff;
      expect(workingWindows([row(1, "10:00", "19:00"), stored], "nina")).toEqual([]);
    });
  });
});

// R390
describe("openingHours", () => {
  it("shows the salon's own hours, leaving closed days out", () => {
    const hours = openingHours([row(1, "10:00", "19:00"), row(6, "11:00", "15:30")], []);

    expect(hours).toEqual([
      { dayOfWeek: 1, opens: "10:00", closes: "19:00" },
      { dayOfWeek: 6, opens: "11:00", closes: "15:30" },
    ]);
  });

  it("is not narrowed or widened by one professional's own schedule", () => {
    const hours = openingHours([row(1, "10:00", "19:00"), row(1, "08:00", "22:00", "nina")], ["nina"]);

    expect(hours).toEqual([{ dayOfWeek: 1, opens: "10:00", closes: "19:00" }]);
  });

  it("falls back to first start – last finish of active professionals when the salon set no hours", () => {
    const rows = [row(2, "09:00", "14:00", "nina"), row(2, "13:00", "20:00", "dato"), row(2, "06:00", "23:00", "gone")];

    expect(openingHours(rows, ["nina", "dato"])).toEqual([{ dayOfWeek: 2, opens: "09:00", closes: "20:00" }]);
  });

  it("collapses a split day to its outer edges and ignores an inverted window", () => {
    const rows = [row(3, "10:00", "13:00"), row(3, "15:00", "19:00"), row(4, "18:00", "09:00")];

    expect(openingHours(rows, [])).toEqual([{ dayOfWeek: 3, opens: "10:00", closes: "19:00" }]);
  });

  // R460
  it("leaves a professional's day off out of the fallback", () => {
    const rows = [row(2, "09:00", "14:00", "nina"), { ...row(2, "00:00", "00:00", "dato"), isDayOff: true }];

    expect(openingHours(rows, ["nina", "dato"])).toEqual([{ dayOfWeek: 2, opens: "09:00", closes: "14:00" }]);
  });

  it("is empty for a salon with no hours at all", () => {
    expect(openingHours([], [])).toEqual([]);
  });
});
