import { BadRequestException } from "@nestjs/common";
import { assertMarkable, canMark } from "./status-marking.js";

const now = new Date("2026-11-18T12:00:00Z");

// R530
describe("marking a booking completed or no-show", () => {
  it("is refused before the appointment starts — a no-show can't happen yet", () => {
    const tomorrow = new Date("2026-11-19T10:00:00Z");
    expect(canMark("no_show", tomorrow, now)).toBe(false);
    expect(canMark("completed", tomorrow, now)).toBe(false);
    expect(() => assertMarkable("no_show", tomorrow, now)).toThrow(BadRequestException);
  });

  it("is allowed from the start time on", () => {
    expect(canMark("no_show", now, now)).toBe(true);
    expect(canMark("completed", new Date("2026-11-18T11:00:00Z"), now)).toBe(true);
  });

  it("always lets a mistaken mark be undone back to booked", () => {
    expect(canMark("booked", new Date("2026-11-19T10:00:00Z"), now)).toBe(true);
  });
});
