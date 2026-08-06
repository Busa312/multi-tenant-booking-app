import { BadRequestException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import { AvailabilityService } from "./availability.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
// Asia/Tbilisi is UTC+4 year-round, so local 09:00 is always 05:00Z and the
// arithmetic below stays readable. DST behaviour is exercised separately.
const TZ = "Asia/Tbilisi";
const WEDNESDAY = "2026-08-05";

/** `@db.Time` comes back from Prisma as a Date on the epoch day, in UTC. */
const timeOfDay = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

interface Overrides {
  timezone?: string;
  services?: { id: string; durationMinutes: number; isActive?: boolean }[];
  /** Lines already stored on the appointment being re-timed, with their snapshots. */
  existingLines?: { serviceId: string; durationMinutes: number; price: Prisma.Decimal }[];
  assignments?: { professionalId: string; serviceId: string }[];
  professionals?: { id: string; name: string }[];
  businessHours?: { professionalId: string | null; dayOfWeek: number; startTime: Date; endTime: Date }[];
  timeOff?: { professionalId: string | null; startAt: Date; endAt: Date; reason: string | null }[];
  appointments?: { professionalId: string | null; startAt: Date; endAt: Date; userName?: string }[];
}

const setup = (overrides: Overrides = {}) => {
  const tx = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: overrides.timezone ?? TZ }) },
    service: {
      // Name/price/isActive are filled in here so the many tests that only care
      // about duration can keep declaring `{ id, durationMinutes }`.
      findMany: jest.fn().mockResolvedValue(
        (overrides.services ?? [{ id: "s1", durationMinutes: 30 }]).map((s) => ({
          name: s.id,
          price: new Prisma.Decimal("10.00"),
          isActive: true,
          ...s,
        })),
      ),
    },
    appointmentService: { findMany: jest.fn().mockResolvedValue(overrides.existingLines ?? []) },
    serviceProfessional: {
      findMany: jest.fn().mockResolvedValue(overrides.assignments ?? [{ professionalId: "p1", serviceId: "s1" }]),
    },
    professional: {
      findMany: jest.fn().mockResolvedValue(overrides.professionals ?? [{ id: "p1", name: "Levan" }]),
      findUnique: jest.fn().mockResolvedValue({ name: "Levan" }),
    },
    businessHours: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          overrides.businessHours ?? [
            { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("12:00") },
          ],
        ),
    },
    timeOff: { findMany: jest.fn().mockResolvedValue(overrides.timeOff ?? []) },
    appointment: { findMany: jest.fn().mockResolvedValue(overrides.appointments ?? []) },
  };

  const prisma = {
    forTenant: jest.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      fn(tx as unknown as Prisma.TransactionClient),
    ),
  } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT_ID } } as unknown as TenantContextService;

  return { service: new AvailabilityService(prisma, tenantContext), tx, prisma };
};

const startTimes = (slots: { startAt: string }[]) => slots.map((slot) => slot.startAt);

describe("AvailabilityService.computeSlots", () => {
  beforeEach(() => {
    // Well before the 05:00Z first slot, so nothing is filtered as past unless
    // a test says so.
    jest.useFakeTimers().setSystemTime(new Date("2026-08-05T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("input validation", () => {
    it("rejects a date that isn't YYYY-MM-DD before opening a transaction", async () => {
      const { service, prisma } = setup();

      await expect(service.computeSlots({ serviceIds: ["s1"], date: "05/08/2026" })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.forTenant).not.toHaveBeenCalled();
    });

    it("rejects a request with no services", async () => {
      const { service } = setup();

      await expect(service.computeSlots({ serviceIds: [], date: WEDNESDAY })).rejects.toThrow(
        "at least one serviceId is required",
      );
    });

    // R120: a deactivated or unknown service yields no availability at all,
    // rather than slots the booking call would then reject.
    it("rejects an unknown service", async () => {
      const { service } = setup({ services: [{ id: "s1", durationMinutes: 30 }] });

      await expect(service.computeSlots({ serviceIds: ["s1", "gone"], date: WEDNESDAY })).rejects.toThrow(
        "Service not found",
      );
    });

    it("rejects a deactivated service", async () => {
      const { service } = setup({ services: [{ id: "s1", durationMinutes: 30, isActive: false }] });

      await expect(service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY })).rejects.toThrow(
        "is deactivated and can't take new bookings",
      );
    });

    it("scopes the service lookup to the tenant", async () => {
      const { service, tx } = setup();
      await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      expect(tx.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }),
      );
    });

    // Booking the same service twice isn't offered yet. Rejecting it also
    // closes a hole: `IN` collapses a repeated id to one row, so a deduplicated
    // sum would quote 30 minutes for two 30-minute haircuts.
    it("rejects the same service listed twice", async () => {
      const { service } = setup();

      await expect(service.computeSlots({ serviceIds: ["s1", "s1"], date: WEDNESDAY })).rejects.toThrow(
        "a service can only be booked once per appointment",
      );
    });
  });

  describe("slot generation", () => {
    it("walks a business-hours window on the 15-minute grid", async () => {
      const { service } = setup();

      const slots = await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      // 09:00–12:00 local (05:00–08:00Z) fits eleven 30-minute starts.
      expect(startTimes(slots)).toEqual([
        "2026-08-05T05:00:00.000Z",
        "2026-08-05T05:15:00.000Z",
        "2026-08-05T05:30:00.000Z",
        "2026-08-05T05:45:00.000Z",
        "2026-08-05T06:00:00.000Z",
        "2026-08-05T06:15:00.000Z",
        "2026-08-05T06:30:00.000Z",
        "2026-08-05T06:45:00.000Z",
        "2026-08-05T07:00:00.000Z",
        "2026-08-05T07:15:00.000Z",
        "2026-08-05T07:30:00.000Z",
      ]);
      expect(slots[0]).toEqual({
        startAt: "2026-08-05T05:00:00.000Z",
        endAt: "2026-08-05T05:30:00.000Z",
        professionalId: "p1",
      });
    });

    it("requires the whole service to fit before the window closes", async () => {
      const { service } = setup({ services: [{ id: "s1", durationMinutes: 45 }] });

      const slots = await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      expect(slots).toHaveLength(10);
      expect(slots.at(-1)).toMatchObject({
        startAt: "2026-08-05T07:15:00.000Z",
        endAt: "2026-08-05T08:00:00.000Z",
      });
    });

    it("sums the duration of a multi-service booking", async () => {
      const { service } = setup({
        services: [
          { id: "s1", durationMinutes: 30 },
          { id: "s2", durationMinutes: 45 },
        ],
        assignments: [
          { professionalId: "p1", serviceId: "s1" },
          { professionalId: "p1", serviceId: "s2" },
        ],
      });

      const slots = await service.computeSlots({ serviceIds: ["s1", "s2"], date: WEDNESDAY });

      expect(slots.at(-1)).toMatchObject({
        startAt: "2026-08-05T06:45:00.000Z", // 10:45 local
        endAt: "2026-08-05T08:00:00.000Z", // 12:00 local
      });
    });

    it("offers nothing when the service is longer than the working day", async () => {
      const { service } = setup({ services: [{ id: "s1", durationMinutes: 240 }] });

      expect(await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY })).toEqual([]);
    });

    it("covers each window of a split shift", async () => {
      const { service } = setup({
        businessHours: [
          { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("10:00") },
          { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("14:00"), endTime: timeOfDay("15:00") },
        ],
      });

      const slots = await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      expect(startTimes(slots)).toEqual([
        "2026-08-05T05:00:00.000Z",
        "2026-08-05T05:15:00.000Z",
        "2026-08-05T05:30:00.000Z",
        "2026-08-05T10:00:00.000Z",
        "2026-08-05T10:15:00.000Z",
        "2026-08-05T10:30:00.000Z",
      ]);
    });

    it("ignores a window that ends at or before it starts", async () => {
      const { service } = setup({
        businessHours: [
          { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("17:00"), endTime: timeOfDay("09:00") },
          { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("09:00") },
        ],
      });

      expect(await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY })).toEqual([]);
    });

    it("asks only for the requested weekday's hours", async () => {
      const { service, tx } = setup();
      await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      expect(tx.businessHours.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ dayOfWeek: 3 }) }),
      );
    });

    // R130: nothing in the past is ever offered.
    it("drops slots that have already started", async () => {
      jest.setSystemTime(new Date("2026-08-05T06:00:00.000Z")); // 10:00 local
      const { service } = setup();

      const slots = await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      expect(startTimes(slots)).toEqual([
        "2026-08-05T06:00:00.000Z",
        "2026-08-05T06:15:00.000Z",
        "2026-08-05T06:30:00.000Z",
        "2026-08-05T06:45:00.000Z",
        "2026-08-05T07:00:00.000Z",
        "2026-08-05T07:15:00.000Z",
        "2026-08-05T07:30:00.000Z",
      ]);
    });

    it("offers nothing for a day that has already ended", async () => {
      jest.setSystemTime(new Date("2026-08-06T00:00:00.000Z"));
      const { service } = setup();

      expect(await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY })).toEqual([]);
    });
  });

  describe("candidate resolution", () => {
    // R140: an explicitly requested professional must actually perform the service.
    it("offers nothing for a professional who doesn't perform the service", async () => {
      const { service, tx } = setup({ assignments: [] });

      expect(await service.computeSlots({ serviceIds: ["s1"], professionalId: "p9", date: WEDNESDAY })).toEqual([]);
      expect(tx.businessHours.findMany).not.toHaveBeenCalled();
    });

    it("offers nothing for a professional who performs only part of a multi-service request", async () => {
      const { service } = setup({
        services: [
          { id: "s1", durationMinutes: 30 },
          { id: "s2", durationMinutes: 30 },
        ],
        assignments: [{ professionalId: "p1", serviceId: "s1" }],
      });

      expect(
        await service.computeSlots({ serviceIds: ["s1", "s2"], professionalId: "p1", date: WEDNESDAY }),
      ).toEqual([]);
    });

    // R120: a deactivated professional has no calendar to offer.
    it("offers nothing when every qualified professional is deactivated", async () => {
      const { service } = setup({ professionals: [] });

      expect(await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY })).toEqual([]);
    });

    it("falls back to the tenant-wide 'any available' calendar when nobody is assigned", async () => {
      const { service } = setup({ assignments: [] });

      const slots = await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      expect(slots).toHaveLength(11);
      expect(slots.every((slot) => slot.professionalId === null)).toBe(true);
    });

    it("returns one entry per (time, professional) and sorts by start time", async () => {
      const { service } = setup({
        assignments: [
          { professionalId: "p1", serviceId: "s1" },
          { professionalId: "p2", serviceId: "s1" },
        ],
        professionals: [
          { id: "p1", name: "Levan" },
          { id: "p2", name: "Nino" },
        ],
        businessHours: [
          { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("09:30") },
        ],
      });

      const slots = await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      expect(slots).toEqual([
        { startAt: "2026-08-05T05:00:00.000Z", endAt: "2026-08-05T05:30:00.000Z", professionalId: "p1" },
        { startAt: "2026-08-05T05:00:00.000Z", endAt: "2026-08-05T05:30:00.000Z", professionalId: "p2" },
      ]);
    });

    it("scopes the assignment lookup to one professional when asked", async () => {
      const { service, tx } = setup();
      await service.computeSlots({ serviceIds: ["s1"], professionalId: "p1", date: WEDNESDAY });

      expect(tx.serviceProfessional.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ professionalId: "p1" }) }),
      );
    });
  });

  describe("business hours precedence", () => {
    it("uses a professional's own hours instead of the tenant-wide ones", async () => {
      const { service } = setup({
        businessHours: [
          { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("17:00") },
          { professionalId: "p1", dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("10:00") },
        ],
      });

      const slots = await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      // Own hours replace the tenant default; they don't extend it.
      expect(startTimes(slots)).toEqual([
        "2026-08-05T05:00:00.000Z",
        "2026-08-05T05:15:00.000Z",
        "2026-08-05T05:30:00.000Z",
      ]);
    });

    it("falls back to the tenant-wide hours for a professional with none of their own", async () => {
      const { service } = setup({
        businessHours: [
          { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("10:00") },
          { professionalId: "p2", dayOfWeek: 3, startTime: timeOfDay("14:00"), endTime: timeOfDay("18:00") },
        ],
      });

      const slots = await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      expect(startTimes(slots)).toEqual([
        "2026-08-05T05:00:00.000Z",
        "2026-08-05T05:15:00.000Z",
        "2026-08-05T05:30:00.000Z",
      ]);
    });

    it("offers nothing on a day with no hours at all", async () => {
      const { service } = setup({ businessHours: [] });

      expect(await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY })).toEqual([]);
    });
  });

  describe("busy time", () => {
    it("removes slots overlapping the professional's time off", async () => {
      const { service } = setup({
        timeOff: [
          {
            professionalId: "p1",
            startAt: new Date("2026-08-05T06:00:00.000Z"), // 10:00–11:00 local
            endAt: new Date("2026-08-05T07:00:00.000Z"),
            reason: "dentist",
          },
        ],
      });

      const slots = await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      // 05:45 is dropped too — a 30-minute service started then would run into
      // the block.
      expect(startTimes(slots)).toEqual([
        "2026-08-05T05:00:00.000Z",
        "2026-08-05T05:15:00.000Z",
        "2026-08-05T05:30:00.000Z",
        "2026-08-05T07:00:00.000Z",
        "2026-08-05T07:15:00.000Z",
        "2026-08-05T07:30:00.000Z",
      ]);
    });

    it("applies tenant-wide time off to every professional", async () => {
      const { service } = setup({
        timeOff: [
          {
            professionalId: null,
            startAt: new Date("2026-08-05T00:00:00.000Z"),
            endAt: new Date("2026-08-06T00:00:00.000Z"),
            reason: "public holiday",
          },
        ],
      });

      expect(await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY })).toEqual([]);
    });

    it("ignores another professional's time off", async () => {
      const { service } = setup({
        timeOff: [
          {
            professionalId: "p2",
            startAt: new Date("2026-08-05T05:00:00.000Z"),
            endAt: new Date("2026-08-05T08:00:00.000Z"),
            reason: null,
          },
        ],
      });

      expect(await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY })).toHaveLength(11);
    });

    it("removes slots overlapping an existing appointment", async () => {
      const { service } = setup({
        appointments: [
          {
            professionalId: "p1",
            startAt: new Date("2026-08-05T05:00:00.000Z"),
            endAt: new Date("2026-08-05T05:30:00.000Z"),
          },
        ],
      });

      const slots = await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      expect(startTimes(slots)).not.toContain("2026-08-05T05:00:00.000Z");
      expect(startTimes(slots)).toContain("2026-08-05T05:30:00.000Z");
      expect(slots).toHaveLength(9);
    });

    it("leaves a slot open when an appointment merely abuts it", async () => {
      const { service } = setup({
        appointments: [
          {
            professionalId: "p1",
            startAt: new Date("2026-08-05T04:30:00.000Z"),
            endAt: new Date("2026-08-05T05:00:00.000Z"),
          },
        ],
      });

      expect(startTimes(await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY }))).toContain(
        "2026-08-05T05:00:00.000Z",
      );
    });

    it("ignores another professional's appointment", async () => {
      const { service } = setup({
        appointments: [
          {
            professionalId: "p2",
            startAt: new Date("2026-08-05T05:00:00.000Z"),
            endAt: new Date("2026-08-05T08:00:00.000Z"),
          },
        ],
      });

      expect(await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY })).toHaveLength(11);
    });

    // R90: cancelling frees the slot again.
    it("excludes cancelled appointments from the occupancy query", async () => {
      const { service, tx } = setup();
      await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      expect(tx.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: { not: "cancelled" } }) }),
      );
    });

    // R80: the reschedule picker must offer the times the appointment being
    // moved already covers — otherwise moving a 10:00 booking to 10:15 is
    // impossible, because it is standing in its own way.
    it("excludes the appointment being moved from the occupancy set", async () => {
      const { service, tx } = setup();

      await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY, excludeAppointmentId: "a1" });

      expect(tx.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { not: "a1" } }) }),
      );
    });

    it("does not filter by id when nothing is being moved", async () => {
      const { service, tx } = setup();

      await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      expect(tx.appointment.findMany.mock.calls[0]?.[0]?.where).not.toHaveProperty("id");
    });

    // The picker and the write path have to measure the same block, or the CMS
    // offers a slot that the reschedule call then rejects as a conflict.
    it("measures a re-timed appointment by its booked duration, not the service's current one", async () => {
      const { service } = setup({
        services: [{ id: "s1", durationMinutes: 90 }],
        existingLines: [{ serviceId: "s1", durationMinutes: 30, price: new Prisma.Decimal("45.00") }],
      });

      const slots = await service.computeSlots({
        serviceIds: ["s1"],
        date: WEDNESDAY,
        excludeAppointmentId: "a1",
      });

      // 30-minute slots across 09:00–12:00, not the 90 minutes the service now takes.
      expect(slots).toHaveLength(11);
      expect(slots[0]?.endAt).toBe("2026-08-05T05:30:00.000Z");
    });

    // Otherwise deactivating a service would make every appointment already
    // holding it unmovable: the picker would 400 and show no slots at all.
    it("still offers slots for a re-timed appointment whose service was deactivated", async () => {
      const { service } = setup({
        services: [{ id: "s1", durationMinutes: 30, isActive: false }],
        existingLines: [{ serviceId: "s1", durationMinutes: 30, price: new Prisma.Decimal("45.00") }],
      });

      const slots = await service.computeSlots({
        serviceIds: ["s1"],
        date: WEDNESDAY,
        excludeAppointmentId: "a1",
      });

      expect(slots).toHaveLength(11);
    });

    it("queries only the requested local day's window", async () => {
      const { service, tx } = setup();
      await service.computeSlots({ serviceIds: ["s1"], date: WEDNESDAY });

      const where = tx.appointment.findMany.mock.calls[0]?.[0]?.where;
      // The tenant-local day, not the UTC one: 00:00–24:00 in Tbilisi.
      expect(where.startAt.lt.toISOString()).toBe("2026-08-05T20:00:00.000Z");
      expect(where.endAt.gt.toISOString()).toBe("2026-08-04T20:00:00.000Z");
    });
  });

  describe("daylight saving", () => {
    it("keeps a window at its local wall-clock time across a spring-forward day", async () => {
      // 2026-03-08 is a Sunday in New York; the clocks jump at 02:00 local, so
      // 09:00 local that day is 13:00Z rather than the 14:00Z it would be the
      // day before.
      jest.setSystemTime(new Date("2026-03-08T00:00:00.000Z"));
      const { service } = setup({
        timezone: "America/New_York",
        businessHours: [
          { professionalId: null, dayOfWeek: 0, startTime: timeOfDay("09:00"), endTime: timeOfDay("12:00") },
        ],
      });

      const slots = await service.computeSlots({ serviceIds: ["s1"], date: "2026-03-08" });

      expect(slots).toHaveLength(11);
      expect(slots[0]?.startAt).toBe("2026-03-08T13:00:00.000Z");
      expect(slots.at(-1)?.startAt).toBe("2026-03-08T15:30:00.000Z");
    });
  });
});

describe("AvailabilityService.findConflictsIn", () => {
  const conflictSetup = (overrides: Overrides = {}) => {
    const { service, tx } = setup({
      businessHours: overrides.businessHours ?? [
        { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("18:00") },
      ],
      ...overrides,
    });
    return { service, tx: tx as unknown as Prisma.TransactionClient & typeof tx };
  };

  // 10:00–11:00 local on the Wednesday.
  const startAt = new Date("2026-08-05T06:00:00.000Z");
  const endAt = new Date("2026-08-05T07:00:00.000Z");

  it("reports nothing for an open window inside business hours", async () => {
    const { service, tx } = conflictSetup();

    expect(await service.findConflictsIn(tx, { professionalId: "p1", startAt, endAt })).toEqual([]);
  });

  it("names the appointment it collides with", async () => {
    const { service, tx } = conflictSetup({
      appointments: [
        {
          professionalId: "p1",
          startAt: new Date("2026-08-05T06:30:00.000Z"),
          endAt: new Date("2026-08-05T07:30:00.000Z"),
          userName: "ნინო",
        },
      ],
    });

    expect(await service.findConflictsIn(tx, { professionalId: "p1", startAt, endAt })).toEqual([
      {
        type: "appointment",
        professionalName: "Levan",
        startAt: "2026-08-05T06:30:00.000Z",
        endAt: "2026-08-05T07:30:00.000Z",
        detail: "ნინო",
      },
    ]);
  });

  it("reports the professional's own time off against their name", async () => {
    const { service, tx } = conflictSetup({
      timeOff: [
        {
          professionalId: "p1",
          startAt: new Date("2026-08-05T06:15:00.000Z"),
          endAt: new Date("2026-08-05T06:45:00.000Z"),
          reason: "dentist",
        },
      ],
    });

    expect(await service.findConflictsIn(tx, { professionalId: "p1", startAt, endAt })).toEqual([
      {
        type: "time_off",
        professionalName: "Levan",
        startAt: "2026-08-05T06:15:00.000Z",
        endAt: "2026-08-05T06:45:00.000Z",
        detail: "dentist",
      },
    ]);
  });

  it("reports tenant-wide time off without attributing it to a professional", async () => {
    const { service, tx } = conflictSetup({
      timeOff: [
        {
          professionalId: null,
          startAt: new Date("2026-08-05T00:00:00.000Z"),
          endAt: new Date("2026-08-06T00:00:00.000Z"),
          reason: "public holiday",
        },
      ],
    });

    const conflicts = await service.findConflictsIn(tx, { professionalId: "p1", startAt, endAt });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ type: "time_off", professionalName: null, detail: "public holiday" });
  });

  it("flags a window that runs past closing time", async () => {
    const { service, tx } = conflictSetup({
      businessHours: [
        { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("10:30") },
      ],
    });

    const conflicts = await service.findConflictsIn(tx, { professionalId: "p1", startAt, endAt });

    expect(conflicts).toEqual([
      { type: "outside_business_hours", professionalName: "Levan", startAt: null, endAt: null, detail: null },
    ]);
  });

  it("flags a window on a day with no business hours", async () => {
    const { service, tx } = conflictSetup({ businessHours: [] });

    expect(await service.findConflictsIn(tx, { professionalId: "p1", startAt, endAt })).toMatchObject([
      { type: "outside_business_hours" },
    ]);
  });

  it("accepts a window spanning two back-to-back windows", async () => {
    const { service, tx } = conflictSetup({
      businessHours: [
        { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("10:30") },
        { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("10:30"), endTime: timeOfDay("18:00") },
      ],
    });

    expect(await service.findConflictsIn(tx, { professionalId: "p1", startAt, endAt })).toEqual([]);
  });

  it("flags a window that falls into the gap of a split shift", async () => {
    const { service, tx } = conflictSetup({
      businessHours: [
        { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("10:15") },
        { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("10:45"), endTime: timeOfDay("18:00") },
      ],
    });

    expect(await service.findConflictsIn(tx, { professionalId: "p1", startAt, endAt })).toMatchObject([
      { type: "outside_business_hours" },
    ]);
  });

  it("reports every collision at once so the CMS can list them", async () => {
    const { service, tx } = conflictSetup({
      businessHours: [
        { professionalId: null, dayOfWeek: 3, startTime: timeOfDay("09:00"), endTime: timeOfDay("10:30") },
      ],
      appointments: [
        {
          professionalId: "p1",
          startAt: new Date("2026-08-05T06:00:00.000Z"),
          endAt: new Date("2026-08-05T06:30:00.000Z"),
          userName: "ნინო",
        },
      ],
      timeOff: [
        {
          professionalId: "p1",
          startAt: new Date("2026-08-05T06:30:00.000Z"),
          endAt: new Date("2026-08-05T07:00:00.000Z"),
          reason: "dentist",
        },
      ],
    });

    const conflicts = await service.findConflictsIn(tx, { professionalId: "p1", startAt, endAt });

    expect(conflicts.map((conflict) => conflict.type)).toEqual([
      "appointment",
      "time_off",
      "outside_business_hours",
    ]);
  });

  // R80: an appointment never conflicts with itself.
  it("excludes the appointment being moved", async () => {
    const { service, tx } = conflictSetup();

    await service.findConflictsIn(tx, { professionalId: "p1", startAt, endAt, excludeAppointmentId: "a1" });

    expect(tx.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: "a1" } }) }),
    );
  });

  it("does not filter by id when nothing is being moved", async () => {
    const { service, tx } = conflictSetup();

    await service.findConflictsIn(tx, { professionalId: "p1", startAt, endAt });

    expect(tx.appointment.findMany.mock.calls[0]?.[0]?.where).not.toHaveProperty("id");
  });

  it("skips the professional lookup for an unassigned booking", async () => {
    const { service, tx } = conflictSetup({
      appointments: [{ professionalId: null, startAt, endAt, userName: "Walk-in" }],
    });

    const conflicts = await service.findConflictsIn(tx, { professionalId: null, startAt, endAt });

    expect(tx.professional.findUnique).not.toHaveBeenCalled();
    expect(conflicts[0]).toMatchObject({ professionalName: null });
  });

  it("checks the hours of every local day a midnight-straddling booking touches", async () => {
    const { service, tx } = conflictSetup();

    await service.findConflictsIn(tx, {
      professionalId: "p1",
      startAt: new Date("2026-08-05T19:00:00.000Z"), // 23:00 Wed local
      endAt: new Date("2026-08-05T21:00:00.000Z"), // 01:00 Thu local
    });

    expect(tx.businessHours.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dayOfWeek: { in: [3, 4] } }) }),
    );
  });

  it("treats an end that lands exactly on midnight as belonging to the day before", async () => {
    const { service, tx } = conflictSetup();

    await service.findConflictsIn(tx, {
      professionalId: "p1",
      startAt: new Date("2026-08-05T19:00:00.000Z"), // 23:00 Wed local
      endAt: new Date("2026-08-05T20:00:00.000Z"), // 00:00 Thu local, exclusive
    });

    expect(tx.businessHours.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dayOfWeek: { in: [3] } }) }),
    );
  });
});
