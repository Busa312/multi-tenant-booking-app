import {
  groupPlannedUnits,
  planVisitAt,
  planVisits,
  type PlannerInput,
  type ProfessionalSchedule,
} from "./visit-planner.js";

// Times are minutes past 09:00 on an arbitrary day, scaled to epoch ms, so the
// assertions read as clock arithmetic.
const MIN = 60_000;
const at = (minutes: number) => minutes * MIN;
const span = (from: number, to: number) => ({ start: at(from), end: at(to) });

const open = (from = 0, to = 600): ProfessionalSchedule => ({ windows: [span(from, to)], busy: [] });

const input = (overrides: Partial<PlannerInput> = {}): PlannerInput => ({
  units: [],
  schedules: new Map(),
  maxGapMinutes: 0,
  gapStepMinutes: 5,
  notBefore: 0,
  ...overrides,
});

describe("planVisitAt", () => {
  // R200: the case that motivated visits — nobody performs both services
  it("splits the visit across professionals when nobody can do every service", () => {
    const plan = planVisitAt(
      input({
        units: [
          { durationMinutes: 90, candidates: ["dato"] },
          { durationMinutes: 45, candidates: ["nina"] },
        ],
        schedules: new Map([
          ["dato", open()],
          ["nina", open()],
        ]),
      }),
      at(60),
    );

    expect(plan?.units).toEqual([
      { unitIndex: 0, professionalId: "dato", start: at(60), end: at(150) },
      // back to back: starts the moment the first ends
      { unitIndex: 1, professionalId: "nina", start: at(150), end: at(195) },
    ]);
    expect(plan?.end).toBe(at(195));
  });

  it("keeps the same professional when they can do the next service too", () => {
    const plan = planVisitAt(
      input({
        units: [
          { durationMinutes: 30, candidates: ["dato", "nina"] },
          // nina is listed first, but dato did the previous service
          { durationMinutes: 30, candidates: ["nina", "dato"] },
        ],
        schedules: new Map([
          ["dato", open()],
          ["nina", open()],
        ]),
      }),
      at(0),
    );

    expect(plan?.units.map((u) => u.professionalId)).toEqual(["dato", "dato"]);
  });

  it("hands over to someone else when the same person is busy for the next service", () => {
    const plan = planVisitAt(
      input({
        units: [
          { durationMinutes: 30, candidates: ["dato"] },
          { durationMinutes: 30, candidates: ["dato", "nina"] },
        ],
        schedules: new Map([
          ["dato", { windows: [span(0, 600)], busy: [span(30, 60)] }],
          ["nina", open()],
        ]),
      }),
      at(0),
    );

    expect(plan?.units.map((u) => u.professionalId)).toEqual(["dato", "nina"]);
  });

  describe("R220: gaps between segments", () => {
    const handoff = (maxGapMinutes: number) =>
      planVisitAt(
        input({
          maxGapMinutes,
          units: [
            { durationMinutes: 60, candidates: ["dato"] },
            { durationMinutes: 30, candidates: ["nina"] },
          ],
          schedules: new Map([
            ["dato", open()],
            // nina is with someone else until 10 past the hand-off
            ["nina", { windows: [span(0, 600)], busy: [span(0, 70)] }],
          ]),
        }),
        at(0),
      );

    it("refuses a gap when the tenant allows none (the default)", () => {
      expect(handoff(0)).toBeNull();
    });

    it("takes the smallest gap that works, within the allowance", () => {
      expect(handoff(15)?.units[1]).toEqual({ unitIndex: 1, professionalId: "nina", start: at(70), end: at(100) });
    });

    it("refuses a gap bigger than the allowance", () => {
      expect(handoff(5)).toBeNull();
    });

    it("never moves the first segment — the visit starts when the customer asked", () => {
      const plan = planVisitAt(
        input({
          maxGapMinutes: 60,
          units: [{ durationMinutes: 30, candidates: ["nina"] }],
          schedules: new Map([["nina", { windows: [span(0, 600)], busy: [span(0, 20)] }]]),
        }),
        at(0),
      );
      expect(plan).toBeNull();
    });
  });

  it("needs each segment inside one open window — a lunch break splits the day", () => {
    const plan = planVisitAt(
      input({
        units: [{ durationMinutes: 60, candidates: ["nina"] }],
        schedules: new Map([["nina", { windows: [span(0, 180), span(240, 480)], busy: [] }]]),
      }),
      at(150),
    );
    expect(plan).toBeNull();
  });

  it("never offers anything starting in the past", () => {
    const plan = planVisitAt(
      input({ notBefore: at(61), units: [{ durationMinutes: 30, candidates: ["nina"] }], schedules: new Map([["nina", open()]]) }),
      at(60),
    );
    expect(plan).toBeNull();
  });

  // R240: never an unassigned segment
  it("has no plan when a service has nobody to perform it", () => {
    const plan = planVisitAt(
      input({
        units: [
          { durationMinutes: 30, candidates: ["nina"] },
          { durationMinutes: 30, candidates: [] },
        ],
        schedules: new Map([["nina", open()]]),
      }),
      at(0),
    );
    expect(plan).toBeNull();
  });
});

describe("planVisits", () => {
  it("returns the same plans as planning each start alone (the shared memo changes nothing)", () => {
    const planner = input({
      maxGapMinutes: 15,
      units: [
        { durationMinutes: 45, candidates: ["dato", "nina"] },
        { durationMinutes: 30, candidates: ["nina"] },
        { durationMinutes: 20, candidates: ["dato", "giorgi"] },
      ],
      schedules: new Map([
        ["dato", { windows: [span(0, 300)], busy: [span(100, 160)] }],
        ["nina", { windows: [span(30, 400)], busy: [span(200, 230)] }],
        ["giorgi", { windows: [span(0, 120)], busy: [] }],
      ]),
    });
    const starts = Array.from({ length: 30 }, (_, i) => at(i * 15));

    expect(planVisits(planner, starts)).toEqual(
      starts.map((start) => planVisitAt(planner, start)).filter((plan) => plan !== null),
    );
  });
});

// R200: what becomes an appointment
describe("groupPlannedUnits", () => {
  const unit = (unitIndex: number, professionalId: string, start: number, end: number) => ({
    unitIndex,
    professionalId,
    start: at(start),
    end: at(end),
  });

  it("merges back-to-back services by one professional into one appointment", () => {
    expect(groupPlannedUnits([unit(0, "dato", 0, 30), unit(1, "dato", 30, 60)])).toEqual([
      { professionalId: "dato", unitIndexes: [0, 1], start: at(0), end: at(60) },
    ]);
  });

  it("keeps a professional's services apart when there's a gap between them", () => {
    expect(groupPlannedUnits([unit(0, "dato", 0, 30), unit(1, "dato", 40, 60)])).toHaveLength(2);
  });

  it("gives a professional who comes back later a separate appointment", () => {
    const groups = groupPlannedUnits([unit(0, "dato", 0, 30), unit(1, "nina", 30, 60), unit(2, "dato", 60, 90)]);
    expect(groups.map((g) => [g.professionalId, g.unitIndexes])).toEqual([
      ["dato", [0]],
      ["nina", [1]],
      ["dato", [2]],
    ]);
  });
});
