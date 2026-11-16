import { dailyRotation, dayWorkload, fairOrder, type DayWorkload } from "./fair-assignment.js";

// R450: "any professional" is assigned fairly.

const H = 3_600_000;
const at = (hours: number) => hours * H;
const day = { start: at(0), end: at(24) };
const load = (bookedHours: number, capacityHours: number): DayWorkload => ({
  bookedMs: bookedHours * H,
  capacityMs: capacityHours * H,
});

describe("dayWorkload", () => {
  it("counts working hours minus time off as capacity", () => {
    const result = dayWorkload({
      day,
      windows: [{ start: at(9), end: at(18) }],
      timeOff: [{ start: at(12), end: at(13) }],
      booked: [],
    });
    expect(result.capacityMs).toBe(8 * H);
  });

  it("ignores time off outside the working hours", () => {
    const result = dayWorkload({
      day,
      windows: [{ start: at(9), end: at(12) }],
      timeOff: [{ start: at(14), end: at(16) }],
      booked: [],
    });
    expect(result.capacityMs).toBe(3 * H);
  });

  it("counts overlapping bookings once, so a double booking doesn't look like double work", () => {
    const result = dayWorkload({
      day,
      windows: [{ start: at(9), end: at(18) }],
      timeOff: [],
      booked: [
        { start: at(10), end: at(11) },
        { start: at(10.5), end: at(11.5) },
      ],
    });
    expect(result.bookedMs).toBe(1.5 * H);
  });

  it("counts a booking outside the hours as work, clipped to the day", () => {
    const result = dayWorkload({
      day,
      windows: [{ start: at(9), end: at(12) }],
      timeOff: [],
      booked: [{ start: at(23), end: at(25) }],
    });
    expect(result.bookedMs).toBe(1 * H);
  });
});

describe("fairOrder", () => {
  it("puts the least-booked professional first, whatever their name", () => {
    const loads = new Map([
      ["ana", load(3, 8)],
      ["zura", load(1, 8)],
    ]);
    expect(fairOrder(["ana", "zura"], loads, "2026-08-05")[0]).toBe("zura");
  });

  it("measures by share of the working day, so a part-timer isn't filled first", () => {
    // Ana works 4h with 2h booked (50%); Zura works 8h with 3h booked (37.5%).
    const loads = new Map([
      ["ana", load(2, 4)],
      ["zura", load(3, 8)],
    ]);
    expect(fairOrder(["ana", "zura"], loads, "2026-08-05")[0]).toBe("zura");
  });

  it("breaks an equal share by fewer booked minutes", () => {
    // Both 25% booked; Ana has 1h, Zura 2h.
    const loads = new Map([
      ["zura", load(2, 8)],
      ["ana", load(1, 4)],
    ]);
    expect(fairOrder(["zura", "ana"], loads, "2026-08-05")[0]).toBe("ana");
  });

  it("never prefers someone with no working time that day", () => {
    const loads = new Map([
      ["off", load(0, 0)],
      ["busy", load(7, 8)],
    ]);
    expect(fairOrder(["off", "busy"], loads, "2026-08-05")).toEqual(["busy", "off"]);
  });

  it("settles a full tie differently from day to day, not by name", () => {
    const loads = new Map([
      ["ana", load(0, 8)],
      ["zura", load(0, 8)],
    ]);
    const firsts = new Set<string>();
    for (let date = 1; date <= 28; date++) {
      firsts.add(fairOrder(["ana", "zura"], loads, `2026-08-${String(date).padStart(2, "0")}`)[0] ?? "");
    }
    expect(firsts).toEqual(new Set(["ana", "zura"]));
  });

  it("gives the same order for the same day, so the time shown is the time held", () => {
    const loads = new Map([
      ["a", load(0, 8)],
      ["b", load(0, 8)],
      ["c", load(0, 8)],
    ]);
    expect(fairOrder(["a", "b", "c"], loads, "2026-08-05")).toEqual(fairOrder(["c", "b", "a"], loads, "2026-08-05"));
  });

  it("doesn't change the list it was given", () => {
    const ids = ["ana", "zura"];
    fairOrder(ids, new Map([["zura", load(0, 8)], ["ana", load(5, 8)]]), "2026-08-05");
    expect(ids).toEqual(["ana", "zura"]);
  });
});

describe("dailyRotation", () => {
  it("is stable for the same day and professional", () => {
    expect(dailyRotation("2026-08-05", "ana")).toBe(dailyRotation("2026-08-05", "ana"));
  });
});
