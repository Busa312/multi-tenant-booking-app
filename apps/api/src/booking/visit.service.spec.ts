import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import { HoldLimitError, VisitService } from "./visit.service.js";
import { hashToken } from "./magic-link.js";
import type { AvailabilityService } from "./availability.service.js";
import type { BookingService } from "./booking.service.js";
import type { PlannedVisit } from "./visit-planner.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const TOKEN = "a".repeat(64);
const NOW = new Date("2026-08-05T00:00:00.000Z");
const FUTURE = new Date("2026-08-06T00:00:00.000Z");
const PAST = new Date("2026-08-04T00:00:00.000Z");
const MIN = 60_000;
const T10 = new Date("2026-08-05T06:00:00.000Z").getTime(); // 10:00 Tbilisi

const colour = { id: "s1", name: "Colour", durationMinutes: 90, price: new Prisma.Decimal("120.00"), isActive: true };
const cut = { id: "s2", name: "Haircut", durationMinutes: 45, price: new Prisma.Decimal("40.00"), isActive: true };

const segment = (overrides: Record<string, unknown> = {}) => ({
  id: "a1",
  tenantId: TENANT_ID,
  visitId: "v1",
  professionalId: "dato",
  locationId: "loc-a",
  startAt: new Date(T10),
  endAt: new Date(T10 + 90 * MIN),
  status: "booked",
  services: [{ serviceId: "s1", durationMinutes: 90, price: new Prisma.Decimal("120.00"), service: { name: "Colour" } }],
  ...overrides,
});

const visitRow = (overrides: Record<string, unknown> = {}) => ({
  id: "v1",
  tenantId: TENANT_ID,
  accessTokenHash: hashToken(TOKEN),
  accessTokenExpiresAt: FUTURE,
  appointments: [segment(), segment({ id: "a2", professionalId: "nina", startAt: new Date(T10 + 90 * MIN), endAt: new Date(T10 + 135 * MIN) })],
  ...overrides,
});

const plan = (units: [number, string, number, number][]): PlannedVisit => ({
  start: (units[0]?.[2] ?? 0) * MIN + T10,
  end: (units[units.length - 1]?.[3] ?? 0) * MIN + T10,
  units: units.map(([unitIndex, professionalId, from, to]) => ({
    unitIndex,
    professionalId,
    start: T10 + from * MIN,
    end: T10 + to * MIN,
  })),
});

interface Overrides {
  visit?: Record<string, unknown> | null;
  plan?: PlannedVisit | null;
  professionals?: { id: string; name: string; isActive: boolean; locationId: string | null }[];
  assignments?: { professionalId: string; serviceId: string }[];
  /** R250: holds already live for the tenant */
  liveHolds?: number;
  /** R300 */
  cutoffHours?: number;
}

const setup = (overrides: Overrides = {}) => {
  const tx = {
    // R260: lockBookingDay
    $executeRaw: jest.fn().mockResolvedValue(1),
    tenant: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: "Asia/Tbilisi", changeCutoffHours: overrides.cutoffHours ?? 0 }),
    },
    service: {
      findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve([colour, cut].filter((service) => where.id.in.includes(service.id))),
      ),
    },
    professional: {
      findMany: jest.fn().mockResolvedValue(
        overrides.professionals ?? [
          { id: "dato", name: "Dato", isActive: true, locationId: null },
          { id: "nina", name: "Nina", isActive: true, locationId: null },
        ],
      ),
    },
    serviceProfessional: {
      findMany: jest.fn().mockResolvedValue(
        overrides.assignments ?? [
          { professionalId: "dato", serviceId: "s1" },
          { professionalId: "nina", serviceId: "s2" },
        ],
      ),
    },
    visit: {
      findFirst: jest.fn().mockResolvedValue(overrides.visit === undefined ? visitRow() : overrides.visit),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "v-new" }),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve(visitRow(data))),
      findUniqueOrThrow: jest.fn().mockResolvedValue(visitRow({ id: "v-new" })),
    },
    appointment: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    slotHold: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      groupBy: jest.fn().mockResolvedValue(Array.from({ length: overrides.liveHolds ?? 0 }, (_, i) => ({ holdId: `h${i}` }))),
    },
  };

  const prisma = {
    forTenant: jest.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      fn(tx as unknown as Prisma.TransactionClient),
    ),
  } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT_ID } } as unknown as TenantContextService;
  const availability = {
    visitPlanAtIn: jest.fn().mockResolvedValue(overrides.plan === undefined ? plan([[0, "dato", 0, 90], [1, "nina", 90, 135]]) : overrides.plan),
    visitPlansIn: jest.fn().mockResolvedValue([]),
  };
  const booking = {
    resolveLocation: jest.fn().mockResolvedValue("loc-a"),
    resolveStartAt: jest.fn().mockReturnValue(new Date(T10)),
    rotateVisitToken: jest.fn().mockResolvedValue("fresh"),
  };

  const service = new VisitService(
    prisma,
    tenantContext,
    availability as unknown as AvailabilityService,
    booking as unknown as BookingService,
  );
  return { service, tx, availability, booking };
};

const createInput = (overrides: Record<string, unknown> = {}) => ({
  serviceIds: ["s1", "s2"],
  professionalIds: ["any", "any"],
  locationId: "loc-a",
  date: "2026-08-05",
  time: "10:00",
  userName: "ნინო",
  phoneNumber: "+995555123456",
  email: "",
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("magic-link lookup", () => {
  it("looks the token up by hash, never by its plaintext, scoped to the tenant", async () => {
    const { service, tx } = setup();

    await service.getByToken(TOKEN);

    const where = tx.visit.findFirst.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where).toMatchObject({ tenantId: TENANT_ID, accessTokenHash: hashToken(TOKEN) });
    expect(JSON.stringify(where)).not.toContain(TOKEN);
  });

  it.each([
    ["an unknown token", { visit: null }],
    ["an expired token", { visit: visitRow({ accessTokenExpiresAt: PAST }) }],
    ["a cancelled visit whose token was cleared", { visit: visitRow({ accessTokenExpiresAt: null }) }],
  ])("answers identically for %s", async (_label, override) => {
    const { service } = setup(override as Overrides);

    await expect(service.getByToken(TOKEN)).rejects.toThrow(NotFoundException);
    await expect(service.getByToken(TOKEN)).rejects.toThrow("This link is no longer valid");
  });

  it("refuses an empty token without going to the database", async () => {
    const { service, tx } = setup();

    await expect(service.getByToken("")).rejects.toThrow("This link is no longer valid");
    expect(tx.visit.findFirst).not.toHaveBeenCalled();
  });
});

// R230: the customer cancels the whole visit
describe("cancel", () => {
  it("cancels every still-booked segment and kills the link", async () => {
    const { service, tx } = setup();

    await service.cancel(TOKEN);

    expect(tx.appointment.updateMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, visitId: "v1", status: "booked" },
      data: { status: "cancelled" },
    });
    expect(tx.visit.update.mock.calls[0]?.[0]?.data).toEqual({ accessTokenHash: null, accessTokenExpiresAt: null });
  });

  // R90: history stays history
  it("leaves a segment staff already marked completed as completed", async () => {
    const { service, tx } = setup();

    await service.cancel(TOKEN);

    const where = tx.appointment.updateMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.status).toBe("booked");
  });

  it("changes nothing when nothing is still booked", async () => {
    const { service, tx } = setup({
      visit: visitRow({ appointments: [segment({ status: "cancelled" }), segment({ id: "a2", status: "completed" })] }),
    });

    await service.cancel(TOKEN);

    expect(tx.appointment.updateMany).not.toHaveBeenCalled();
    expect(tx.visit.update).not.toHaveBeenCalled();
  });
});

describe("reschedule", () => {
  it("moves the whole visit, each segment keeping its professional (R230)", async () => {
    const { service, availability } = setup();

    await service.reschedule(TOKEN, "2026-08-07", "10:00");

    const [, input] = availability.visitPlanAtIn.mock.calls[0] ?? [];
    expect(input).toMatchObject({
      excludeVisitId: "v1",
      keepExistingPairings: true,
      units: [
        { professionalId: "dato", serviceIds: ["s1"], durationMinutes: 90 },
        { professionalId: "nina", serviceIds: ["s1"], durationMinutes: 45 },
      ],
    });
  });

  it("writes each segment's new times from the plan", async () => {
    const { service, tx } = setup({ plan: plan([[0, "dato", 60, 150], [1, "nina", 155, 200]]) });

    await service.reschedule(TOKEN, "2026-08-07", "11:00");

    expect(tx.appointment.update.mock.calls.map((c) => [c[0].where.id, c[0].data.startAt, c[0].data.endAt])).toEqual([
      ["a1", new Date(T10 + 60 * MIN), new Date(T10 + 150 * MIN)],
      ["a2", new Date(T10 + 155 * MIN), new Date(T10 + 200 * MIN)],
    ]);
  });

  // R230: the link the customer already has keeps working — nothing new to text
  it("keeps the link, moving only its expiry to a day after the new end", async () => {
    const { service, tx } = setup({ plan: plan([[0, "dato", 0, 90], [1, "nina", 90, 135]]) });

    await service.reschedule(TOKEN, "2026-08-07", "10:00");

    const data = tx.visit.update.mock.calls[0]?.[0]?.data;
    expect(data).toEqual({ accessTokenExpiresAt: new Date(T10 + 135 * MIN + 24 * 60 * MIN) });
  });

  it("refuses a time the visit no longer fits with a 409, writing nothing", async () => {
    const { service, tx } = setup({ plan: null });

    await expect(service.reschedule(TOKEN, "2026-08-07", "10:00")).rejects.toThrow(ConflictException);
    expect(tx.appointment.update).not.toHaveBeenCalled();
    expect(tx.visit.update).not.toHaveBeenCalled();
  });

  it("refuses a fully cancelled visit", async () => {
    const { service } = setup({ visit: visitRow({ appointments: [segment({ status: "cancelled" })] }) });

    await expect(service.reschedule(TOKEN, "2026-08-07", "10:00")).rejects.toThrow(BadRequestException);
  });
});

describe("create", () => {
  it("books one appointment per professional segment, all on one new visit (R200)", async () => {
    const { service, tx } = setup();

    await service.create(createInput());

    expect(tx.visit.create).toHaveBeenCalledTimes(1);
    const written = tx.appointment.create.mock.calls.map((c) => c[0].data);
    expect(written.map((d) => [d.visitId, d.professionalId, d.price.toString()])).toEqual([
      ["v-new", "dato", "120"],
      ["v-new", "nina", "40"],
    ]);
    expect(written[1]?.startAt).toEqual(new Date(T10 + 90 * MIN));
  });

  it("puts back-to-back services by one professional on one appointment", async () => {
    const { service, tx } = setup({ plan: plan([[0, "dato", 0, 90], [1, "dato", 90, 135]]) });

    await service.create(createInput());

    expect(tx.appointment.create).toHaveBeenCalledTimes(1);
    const data = tx.appointment.create.mock.calls[0]?.[0]?.data;
    expect(data.services.create.map((l: { serviceId: string; position: number }) => [l.serviceId, l.position])).toEqual([
      ["s1", 0],
      ["s2", 1],
    ]);
    expect(data.price.toString()).toBe("160");
  });

  it("stores only the token's hash and returns the plaintext once", async () => {
    const { service, tx } = setup();

    const result = await service.create(createInput());

    const data = tx.visit.create.mock.calls[0]?.[0]?.data as { accessTokenHash: string };
    expect(data.accessTokenHash).toBe(hashToken(result.magicLinkToken));
  });

  it("answers 409 — and writes nothing — when the slot went while the customer was typing", async () => {
    const { service, tx } = setup({ plan: null });

    await expect(service.create(createInput())).rejects.toThrow(ConflictException);
    expect(tx.visit.create).not.toHaveBeenCalled();
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });

  it("needs exactly one professional choice per service", async () => {
    const { service } = setup();

    await expect(service.create(createInput({ professionalIds: ["any"] }))).rejects.toThrow(BadRequestException);
  });

  it("refuses a professional picked for a service they don't perform", async () => {
    const { service } = setup();

    await expect(service.create(createInput({ professionalIds: ["nina", "any"] }))).rejects.toThrow(
      'Nina doesn\'t perform "Colour"',
    );
  });

  it("refuses a professional who works at another branch (R180)", async () => {
    const { service } = setup({
      professionals: [{ id: "dato", name: "Dato", isActive: true, locationId: "loc-b" }],
    });

    await expect(service.create(createInput({ professionalIds: ["dato", "any"] }))).rejects.toThrow(
      "Dato doesn't work at that location",
    );
  });

  // R210
  it("refuses more than five services", async () => {
    const { service } = setup();

    await expect(
      service.create(createInput({ serviceIds: ["a", "b", "c", "d", "e", "f"], professionalIds: Array(6).fill("any") })),
    ).rejects.toThrow("at most 5 services");
  });
});

// R300: the visit starts at 10:00 Tbilisi (06:00Z); it's now 04:00 Tbilisi (00:00Z) — six hours before
describe("the change cutoff", () => {
  it("lets the customer reschedule and cancel while they're outside it", async () => {
    const { service } = setup({ cutoffHours: 6 - 1 });

    await expect(service.reschedule(TOKEN, "2026-08-07", "12:00")).resolves.toBeDefined();
    await expect(service.cancel(TOKEN)).resolves.toBeDefined();
  });

  it("refuses rescheduling once inside it, writing nothing", async () => {
    const { service, tx } = setup({ cutoffHours: 6 });

    const error = await service.reschedule(TOKEN, "2026-08-07", "12:00").catch((e: unknown) => e);

    expect((error as ForbiddenException).getStatus()).toBe(403);
    expect((error as ForbiddenException).getResponse()).toMatchObject({ code: "change_cutoff" });
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });

  it("refuses cancelling once inside it", async () => {
    const { service, tx } = setup({ cutoffHours: 12 });

    await expect(service.cancel(TOKEN)).rejects.toThrow(ForbiddenException);
    expect(tx.appointment.updateMany).not.toHaveBeenCalled();
  });

  it("doesn't even offer new times once inside it", async () => {
    const { service, availability } = setup({ cutoffHours: 12 });

    await expect(service.rescheduleSlots(TOKEN, "2026-08-07")).rejects.toThrow(ForbiddenException);
    expect(availability.visitPlansIn).not.toHaveBeenCalled();
  });

  it("with no cutoff, still stops at the visit's start", async () => {
    jest.setSystemTime(new Date("2026-08-05T06:30:00.000Z"));
    const { service } = setup({ cutoffHours: 0 });

    await expect(service.cancel(TOKEN)).rejects.toThrow(ForbiddenException);
  });
});

// R260
describe("the day's lock", () => {
  const lockCalls = (tx: { $executeRaw: jest.Mock }) =>
    tx.$executeRaw.mock.calls.map(([strings, ...values]: [TemplateStringsArray, ...unknown[]]) => ({
      sql: strings.join("?"),
      values,
    }));

  it("takes the tenant's lock for the booked day before planning a booking", async () => {
    const { service, tx, availability } = setup();
    availability.visitPlanAtIn.mockImplementation(() => {
      // Planning is the availability check: by now the lock must be held.
      expect(lockCalls(tx)).toEqual([
        { sql: expect.stringContaining("pg_advisory_xact_lock"), values: [`booking:${TENANT_ID}:2026-08-05`] },
      ]);
      return Promise.resolve(plan([[0, "dato", 0, 90], [1, "nina", 90, 135]]));
    });

    await service.create(createInput());

    expect(availability.visitPlanAtIn).toHaveBeenCalled();
  });

  it("takes it for the new day before re-planning a reschedule", async () => {
    const { service, tx } = setup();

    await service.reschedule(TOKEN, "2026-08-07", "12:00");

    expect(lockCalls(tx)[0]?.values).toEqual([`booking:${TENANT_ID}:2026-08-07`]);
  });

  it("takes it before planning a hold", async () => {
    const { service, tx } = setup();

    await service.hold(createInput());

    expect(lockCalls(tx)[0]?.values).toEqual([`booking:${TENANT_ID}:2026-08-05`]);
  });
});

// R250
describe("hold", () => {
  const HOLD = "22222222-2222-2222-2222-222222222222";

  it("holds each segment of the planned visit for ten minutes under one hold id", async () => {
    const { service, tx } = setup();

    const result = await service.hold(createInput());

    const rows = tx.slotHold.createMany.mock.calls[0]?.[0]?.data as Record<string, unknown>[];
    expect(rows.map((row) => [row.professionalId, row.startAt, row.endAt])).toEqual([
      ["dato", new Date(T10), new Date(T10 + 90 * MIN)],
      ["nina", new Date(T10 + 90 * MIN), new Date(T10 + 135 * MIN)],
    ]);
    expect(new Set(rows.map((row) => row.holdId))).toEqual(new Set([result.holdId]));
    expect(rows.every((row) => row.tenantId === TENANT_ID)).toBe(true);
    expect(result.expiresAt).toEqual(new Date(NOW.getTime() + 10 * MIN));
  });

  it("returns the plan actually held, which may differ from the one the customer was shown", async () => {
    const { service } = setup({ plan: plan([[0, "dato", 0, 90], [1, "dato", 90, 135]]) });

    const { slot } = await service.hold(createInput());

    expect(slot.segments).toEqual([
      {
        serviceIds: ["s1", "s2"],
        professionalId: "dato",
        startAt: new Date(T10).toISOString(),
        endAt: new Date(T10 + 135 * MIN).toISOString(),
      },
    ]);
  });

  it("replaces the customer's previous hold", async () => {
    const { service, tx } = setup();

    await service.hold({ ...createInput(), replaceHoldId: HOLD });

    expect(tx.slotHold.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, holdId: HOLD } });
  });

  it("answers 409 when the time is gone — and still lets go of the previous hold", async () => {
    const { service, tx } = setup({ plan: null });

    await expect(service.hold({ ...createInput(), replaceHoldId: HOLD })).rejects.toThrow(ConflictException);
    expect(tx.slotHold.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, holdId: HOLD } });
    expect(tx.slotHold.createMany).not.toHaveBeenCalled();
  });

  it("plans without excluding any hold — a customer can't hold over someone else's", async () => {
    const { service, availability } = setup();

    await service.hold(createInput());

    expect(availability.visitPlanAtIn.mock.calls[0]?.[1]).toMatchObject({ excludeHoldId: null });
  });

  it("refuses once the tenant has too many live holds, writing none", async () => {
    const { service, tx } = setup({ liveHolds: 40 });

    await expect(service.hold(createInput())).rejects.toThrow(HoldLimitError);
    expect(tx.slotHold.createMany).not.toHaveBeenCalled();
  });

  it("only counts holds that haven't expired", async () => {
    const { service, tx } = setup();

    await service.hold(createInput());

    expect(tx.slotHold.groupBy).toHaveBeenCalledWith({
      by: ["holdId"],
      where: { tenantId: TENANT_ID, expiresAt: { gt: NOW } },
    });
  });

  it("is used up by the booking made with it, which it doesn't block", async () => {
    const { service, tx, availability } = setup();

    await service.create({ ...createInput(), holdId: HOLD });

    expect(availability.visitPlanAtIn.mock.calls[0]?.[1]).toMatchObject({ excludeHoldId: HOLD });
    expect(tx.slotHold.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, holdId: HOLD } });
  });

  it("keeps the hold when the booking fails", async () => {
    const { service, tx } = setup({ plan: null });

    await expect(service.create({ ...createInput(), holdId: HOLD })).rejects.toThrow(ConflictException);
    expect(tx.slotHold.deleteMany).not.toHaveBeenCalled();
  });

  it("release deletes only this tenant's rows for that hold", async () => {
    const { service, tx } = setup();

    await service.release(HOLD);

    expect(tx.slotHold.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, holdId: HOLD } });
  });
});

describe("resend lookup", () => {
  it("only considers live links with an upcoming, uncancelled segment for that number", async () => {
    const { service, tx } = setup();

    await service.findResendable("+995555123456");

    expect(tx.visit.findMany.mock.calls[0]?.[0]?.where).toEqual({
      tenantId: TENANT_ID,
      accessTokenHash: { not: null },
      accessTokenExpiresAt: { gt: NOW },
      appointments: {
        // R270: the fresh link is texted to this number, so no address is needed
        some: { phoneNumber: "+995555123456", status: { not: "cancelled" }, startAt: { gt: NOW } },
      },
    });
  });
});
