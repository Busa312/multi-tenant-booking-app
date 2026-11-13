import { finishedVisitsByPhone, noShowHistoryBefore, type FinishedSegment } from "./no-show-history.js";

const PHONE = "995555000001";

const segment = (overrides: Partial<FinishedSegment> & { id: string; day: number }): FinishedSegment => ({
  visitId: null,
  phoneKey: PHONE,
  status: "completed",
  startAt: new Date(Date.UTC(2026, 9, overrides.day, 8)),
  ...overrides,
});

const NOW = new Date("2026-11-13T08:00:00Z");

// R360
describe("no-show history", () => {
  it("says nothing about a customer with no finished visit", () => {
    expect(noShowHistoryBefore(undefined, NOW)).toBeNull();
    expect(noShowHistoryBefore([], NOW)).toBeNull();
  });

  it("counts the missed among the last three finished visits", () => {
    const visits = finishedVisitsByPhone([
      segment({ id: "a", day: 1, status: "no_show" }),
      segment({ id: "b", day: 2 }),
      segment({ id: "c", day: 3, status: "no_show" }),
      segment({ id: "d", day: 4, status: "no_show" }),
    ]).get(PHONE);

    // the oldest (day 1) has dropped out of the last three
    expect(noShowHistoryBefore(visits, NOW)).toEqual({ missed: 2, of: 3 });
  });

  it("reports fewer than three when that is all there is", () => {
    const visits = finishedVisitsByPhone([segment({ id: "a", day: 1, status: "no_show" })]).get(PHONE);
    expect(noShowHistoryBefore(visits, NOW)).toEqual({ missed: 1, of: 1 });
  });

  it("counts a visit once, however many segments it has", () => {
    const visits = finishedVisitsByPhone([
      segment({ id: "a", day: 1, visitId: "v1", status: "no_show" }),
      segment({ id: "b", day: 1, visitId: "v1", status: "no_show" }),
      segment({ id: "c", day: 2 }),
    ]).get(PHONE);

    expect(noShowHistoryBefore(visits, NOW)).toEqual({ missed: 1, of: 2 });
  });

  it("does not call a visit missed when the customer came to part of it", () => {
    const visits = finishedVisitsByPhone([
      segment({ id: "a", day: 1, visitId: "v1", status: "no_show" }),
      segment({ id: "b", day: 1, visitId: "v1", status: "completed" }),
    ]).get(PHONE);

    expect(noShowHistoryBefore(visits, NOW)).toEqual({ missed: 0, of: 1 });
  });

  it("looks only at visits before the appointment in question", () => {
    const visits = finishedVisitsByPhone([
      segment({ id: "a", day: 1 }),
      segment({ id: "b", day: 5, status: "no_show" }),
    ]).get(PHONE);

    // an appointment on day 3 can't be judged by a no-show that came after it
    expect(noShowHistoryBefore(visits, new Date(Date.UTC(2026, 9, 3, 8)))).toEqual({ missed: 0, of: 1 });
  });

  it("keeps each phone's history apart", () => {
    const byPhone = finishedVisitsByPhone([
      segment({ id: "a", day: 1, status: "no_show" }),
      segment({ id: "b", day: 1, phoneKey: "995555000002" }),
    ]);

    expect(noShowHistoryBefore(byPhone.get(PHONE), NOW)).toEqual({ missed: 1, of: 1 });
    expect(noShowHistoryBefore(byPhone.get("995555000002"), NOW)).toEqual({ missed: 0, of: 1 });
  });
});
