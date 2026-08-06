import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import { BookingService } from "./booking.service.js";
import type { AvailabilityService } from "./availability.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const TZ = "Asia/Tbilisi"; // UTC+4, no DST: local 10:00 is 06:00Z.

type ServiceRow = { id: string; name: string; durationMinutes: number; price: Prisma.Decimal; isActive: boolean };
type ProfessionalRow = { id: string; name: string; isActive: boolean };
/** A line already stored on the appointment, with its booked-at snapshots. */
type LineRow = { serviceId: string; position: number; durationMinutes: number; price: Prisma.Decimal };
type AppointmentRow = {
  id: string;
  tenantId: string;
  professionalId: string | null;
  startAt: Date;
  endAt: Date;
  status: string;
  accessTokenHash: string | null;
  services: LineRow[];
};

/**
 * The `data` payload a Prisma write received. Every field is declared present
 * so assertions can read them without narrowing; the tests that care about a
 * field being *absent* assert that at runtime with `not.toHaveProperty`.
 */
interface AppointmentWriteData {
  tenantId: string;
  professionalId: string | null;
  userName: string;
  phoneNumber: string;
  email: string;
  startAt: Date;
  endAt: Date;
  price: Prisma.Decimal;
  notes: string | null;
  createdByUserId: string | null;
  accessTokenHash: string | null;
  accessTokenExpiresAt: Date | null;
  services: { create: LineRow[] };
}

type WriteArgs = { data: AppointmentWriteData; include?: unknown };

interface Overrides {
  services?: ServiceRow[];
  professionals?: ProfessionalRow[];
  /** Which (professionalId, serviceId) pairings exist; defaults to p1 doing s1. */
  assignments?: { professionalId: string; serviceId: string }[];
  appointment?: Partial<AppointmentRow>;
  conflicts?: unknown[];
}

const defaultService: ServiceRow = {
  id: "s1",
  name: "Haircut",
  durationMinutes: 30,
  price: new Prisma.Decimal("45.00"),
  isActive: true,
};

const beardTrim: ServiceRow = {
  id: "s2",
  name: "Beard trim",
  durationMinutes: 15,
  price: new Prisma.Decimal("15.00"),
  isActive: true,
};

const setup = (overrides: Overrides = {}) => {
  const services = overrides.services ?? [defaultService];
  const professionals = overrides.professionals ?? [{ id: "p1", name: "Levan", isActive: true }];
  const assignments =
    overrides.assignments ??
    professionals.flatMap((p) => services.map((s) => ({ professionalId: p.id, serviceId: s.id })));
  const existing: AppointmentRow = {
    id: "a1",
    tenantId: TENANT_ID,
    professionalId: "p1",
    startAt: new Date("2026-08-05T06:00:00.000Z"),
    endAt: new Date("2026-08-05T06:30:00.000Z"),
    status: "booked",
    accessTokenHash: null,
    services: [{ serviceId: "s1", position: 0, durationMinutes: 30, price: new Prisma.Decimal("45.00") }],
    ...overrides.appointment,
  };

  const tx = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: TZ }) },
    service: {
      findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(services.filter((row) => where.id.in.includes(row.id))),
      ),
    },
    professional: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(professionals.find((row) => row.id === where.id) ?? null),
      ),
    },
    serviceProfessional: {
      findMany: jest.fn(({ where }: { where: { professionalId: string; serviceId: { in: string[] } } }) =>
        Promise.resolve(
          assignments.filter((a) => a.professionalId === where.professionalId && where.serviceId.in.includes(a.serviceId)),
        ),
      ),
    },
    appointment: {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn(({ data }: WriteArgs) => Promise.resolve({ id: "new", ...data })),
      update: jest.fn(({ data }: WriteArgs) => Promise.resolve({ id: "a1", ...data })),
    },
    appointmentService: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prisma = {
    forTenant: jest.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      fn(tx as unknown as Prisma.TransactionClient),
    ),
  } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT_ID } } as unknown as TenantContextService;
  const availability = {
    findConflictsIn: jest.fn().mockResolvedValue(overrides.conflicts ?? []),
  };

  return {
    service: new BookingService(prisma, tenantContext, availability as unknown as AvailabilityService),
    tx,
    availability,
    existing,
  };
};

const createInput = (overrides: Record<string, unknown> = {}) => ({
  serviceIds: ["s1"],
  professionalId: "p1" as string | null,
  date: "2026-08-05",
  time: "10:00",
  userName: "ნინო",
  phoneNumber: "+995555123456",
  createdByUserId: "uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu",
  ...overrides,
});

type TxStub = ReturnType<typeof setup>["tx"];

const createdData = (tx: TxStub): AppointmentWriteData => {
  const call = tx.appointment.create.mock.calls[0];
  if (!call) throw new Error("expected appointment.create to have been called");
  return call[0].data;
};

const updatedData = (tx: TxStub): AppointmentWriteData => {
  const call = tx.appointment.update.mock.calls[0];
  if (!call) throw new Error("expected appointment.update to have been called");
  return call[0].data;
};

/** The lines an update rewrote, as handed to createMany. */
const rewrittenLines = (tx: TxStub): LineRow[] => {
  const call = tx.appointmentService.createMany.mock.calls[0];
  if (!call) throw new Error("expected appointmentService.createMany to have been called");
  return call[0].data;
};

beforeEach(() => {
  // 04:00 local — before the 10:00 bookings below, so nothing is "in the past"
  // unless a test moves the clock.
  jest.useFakeTimers().setSystemTime(new Date("2026-08-05T00:00:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("BookingService.create", () => {
  it("derives end_at from the service duration rather than trusting the caller", async () => {
    const { service, tx } = setup({
      services: [{ ...defaultService, durationMinutes: 90 }],
    });

    await service.create(createInput({ endAt: new Date("2030-01-01T00:00:00.000Z") }));

    expect(createdData(tx).startAt.toISOString()).toBe("2026-08-05T06:00:00.000Z");
    expect(createdData(tx).endAt.toISOString()).toBe("2026-08-05T07:30:00.000Z");
  });

  it("snapshots the service price onto the appointment", async () => {
    const { service, tx } = setup();

    await service.create(createInput());

    expect(createdData(tx).price.toString()).toBe("45");
  });

  it("resolves the wall-clock time against the tenant's timezone", async () => {
    const { service, tx } = setup();

    await service.create(createInput({ date: "2026-08-05", time: "17:45" }));

    expect(createdData(tx).startAt.toISOString()).toBe("2026-08-05T13:45:00.000Z");
  });

  // R70: staff-created bookings carry no customer link.
  it("issues no magic-link token", async () => {
    const { service, tx } = setup();

    await service.create(createInput());

    expect(createdData(tx)).toMatchObject({ accessTokenHash: null, accessTokenExpiresAt: null });
  });

  it("records who created it and asks for the summary shape back", async () => {
    const { service, tx } = setup();

    await service.create(createInput());

    expect(createdData(tx).createdByUserId).toBe("uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu");
    expect(tx.appointment.create.mock.calls[0]?.[0]?.include).toHaveProperty("services");
  });

  describe("service lines", () => {
    it("writes one line per requested service, in the order they were asked for", async () => {
      const { service, tx } = setup({ services: [defaultService, beardTrim] });

      await service.create(createInput({ serviceIds: ["s2", "s1"] }));

      expect(createdData(tx).services.create).toEqual([
        { tenantId: TENANT_ID, serviceId: "s2", position: 0, durationMinutes: 15, price: beardTrim.price },
        { tenantId: TENANT_ID, serviceId: "s1", position: 1, durationMinutes: 30, price: defaultService.price },
      ]);
    });

    it("runs the services as one block ending after their summed duration", async () => {
      const { service, tx } = setup({ services: [defaultService, beardTrim] });

      await service.create(createInput({ serviceIds: ["s1", "s2"] }));

      // 10:00 local (06:00Z) + 30 + 15 minutes.
      expect(createdData(tx).endAt.toISOString()).toBe("2026-08-05T06:45:00.000Z");
    });

    it("totals the price as Decimal, not through floating point", async () => {
      const { service, tx } = setup({
        services: [
          { ...defaultService, price: new Prisma.Decimal("10.10") },
          { ...beardTrim, price: new Prisma.Decimal("20.20") },
        ],
      });

      await service.create(createInput({ serviceIds: ["s1", "s2"] }));

      // 10.10 + 20.20 is 30.299999999999997 in binary floating point.
      expect(createdData(tx).price.toString()).toBe("30.3");
    });

    it("snapshots each line's own duration and price", async () => {
      const { service, tx } = setup({ services: [defaultService, beardTrim] });

      await service.create(createInput({ serviceIds: ["s1", "s2"] }));

      expect(createdData(tx).services.create.map((line) => [line.durationMinutes, line.price.toString()])).toEqual([
        [30, "45"],
        [15, "15"],
      ]);
    });

    it("rejects a booking with no services", async () => {
      const { service } = setup();

      await expect(service.create(createInput({ serviceIds: [] }))).rejects.toThrow(
        "at least one serviceId is required",
      );
    });

    it("rejects the same service twice", async () => {
      const { service } = setup();

      await expect(service.create(createInput({ serviceIds: ["s1", "s1"] }))).rejects.toThrow(
        "a service can only be booked once per appointment",
      );
    });
  });

  describe("customer details", () => {
    it("trims the name and phone number", async () => {
      const { service, tx } = setup();

      await service.create(createInput({ userName: "  Nino  ", phoneNumber: " +995555123456 " }));

      expect(createdData(tx)).toMatchObject({ userName: "Nino", phoneNumber: "+995555123456" });
    });

    it.each([
      ["userName", { userName: "   " }],
      ["userName", { userName: "" }],
      ["phoneNumber", { phoneNumber: "  " }],
    ])("rejects a blank %s", async (field, patch) => {
      const { service } = setup();

      await expect(service.create(createInput(patch))).rejects.toThrow(`${field} is required`);
    });

    // R30: email is optional on the form but NOT NULL in the schema.
    it("stores an empty string when no email is given", async () => {
      const { service, tx } = setup();

      await service.create(createInput());

      expect(createdData(tx).email).toBe("");
    });

    it("trims a supplied email", async () => {
      const { service, tx } = setup();

      await service.create(createInput({ email: " nino@example.com " }));

      expect(createdData(tx).email).toBe("nino@example.com");
    });

    it("normalises blank notes to null", async () => {
      const { service, tx } = setup();

      await service.create(createInput({ notes: "   " }));

      expect(createdData(tx).notes).toBeNull();
    });

    it("keeps real notes, trimmed", async () => {
      const { service, tx } = setup();

      await service.create(createInput({ notes: " regular client " }));

      expect(createdData(tx).notes).toBe("regular client");
    });
  });

  describe("time validation", () => {
    it.each([
      ["05/08/2026", "10:00"],
      ["2026-08-05", "10am"],
      ["2026-08-05", "25:00"],
    ])("rejects date %p time %p", async (date, time) => {
      const { service } = setup();

      await expect(service.create(createInput({ date, time }))).rejects.toThrow(
        "date must be YYYY-MM-DD and time must be HH:mm",
      );
    });

    // R130
    it("refuses a booking in the past", async () => {
      jest.setSystemTime(new Date("2026-08-05T09:00:00.000Z")); // 13:00 local
      const { service } = setup();

      await expect(service.create(createInput())).rejects.toThrow("a booking can't be created in the past");
    });

    it("allows a booking starting exactly now", async () => {
      jest.setSystemTime(new Date("2026-08-05T06:00:00.000Z"));
      const { service } = setup();

      await expect(service.create(createInput())).resolves.toBeDefined();
    });
  });

  describe("service and professional eligibility", () => {
    it("404s on an unknown service", async () => {
      const { service } = setup({ services: [] });

      await expect(service.create(createInput())).rejects.toThrow(NotFoundException);
    });

    // R120
    it("refuses a deactivated service", async () => {
      const { service } = setup({ services: [{ ...defaultService, isActive: false }] });

      await expect(service.create(createInput())).rejects.toThrow(
        '"Haircut" is deactivated and can\'t take new bookings',
      );
    });

    it("404s on an unknown professional", async () => {
      const { service } = setup({ professionals: [] });

      await expect(service.create(createInput())).rejects.toThrow(NotFoundException);
    });

    // R120
    it("refuses a deactivated professional", async () => {
      const { service } = setup({ professionals: [{ id: "p1", name: "Levan", isActive: false }] });

      await expect(service.create(createInput())).rejects.toThrow(
        "Levan is deactivated and can't take new bookings",
      );
    });

    // R140
    it("refuses a professional who doesn't perform the service", async () => {
      const { service } = setup({ assignments: [] });

      await expect(service.create(createInput())).rejects.toThrow('Levan doesn\'t perform "Haircut"');
    });

    // R140 across the whole block: a slot is only ever offered for someone who
    // can do all of it, so a booking must hold to the same rule.
    it("names the one service a professional doesn't perform", async () => {
      const { service } = setup({
        services: [defaultService, beardTrim],
        assignments: [{ professionalId: "p1", serviceId: "s1" }],
      });

      await expect(service.create(createInput({ serviceIds: ["s1", "s2"] }))).rejects.toThrow(
        'Levan doesn\'t perform "Beard trim"',
      );
    });

    it("skips the professional checks for an 'any available' booking", async () => {
      const { service, tx } = setup({ assignments: [] });

      await service.create(createInput({ professionalId: null }));

      expect(tx.professional.findFirst).not.toHaveBeenCalled();
      expect(createdData(tx).professionalId).toBeNull();
    });
  });

  describe("conflicts", () => {
    // R60: a conflict is a warning the caller must have seen, not a wall.
    it("409s with every named conflict when the window isn't clear", async () => {
      const conflicts = [
        { type: "appointment", professionalName: "Levan", startAt: "x", endAt: "y", detail: "ნინო" },
      ];
      const { service, tx } = setup({ conflicts });

      await expect(service.create(createInput())).rejects.toThrow(ConflictException);
      expect(tx.appointment.create).not.toHaveBeenCalled();

      await expect(service.create(createInput()).catch((error) => error.getResponse())).resolves.toEqual({
        code: "booking_conflict",
        conflicts,
      });
    });

    it("books over a conflict once the caller confirms", async () => {
      const { service, tx, availability } = setup({ conflicts: [{ type: "appointment" }] });

      await service.create(createInput({ override: true }));

      expect(availability.findConflictsIn).not.toHaveBeenCalled();
      expect(tx.appointment.create).toHaveBeenCalled();
    });

    it("checks conflicts inside the same transaction as the write", async () => {
      const { service, tx, availability } = setup();

      await service.create(createInput());

      expect(availability.findConflictsIn).toHaveBeenCalledWith(tx, {
        professionalId: "p1",
        startAt: new Date("2026-08-05T06:00:00.000Z"),
        endAt: new Date("2026-08-05T06:30:00.000Z"),
        excludeAppointmentId: undefined,
      });
    });
  });
});

describe("BookingService.update", () => {
  const updateInput = (overrides: Record<string, unknown> = {}) => ({
    appointmentId: "a1",
    professionalScope: null as string | null,
    ...overrides,
  });

  describe("input validation", () => {
    it.each([
      ["a date without a time", { date: "2026-08-06" }],
      ["a time without a date", { time: "11:00" }],
    ])("rejects %s", async (_label, patch) => {
      const { service } = setup();

      await expect(service.update(updateInput(patch))).rejects.toThrow(
        "date and time must be sent together",
      );
    });

    it("rejects an update that changes nothing", async () => {
      const { service } = setup();

      await expect(service.update(updateInput())).rejects.toThrow(
        "an update must change the time, the professional, the services, or some of them",
      );
    });

    it("accepts a services-only change", async () => {
      const { service, tx } = setup({ services: [defaultService, beardTrim] });

      await service.update(updateInput({ serviceIds: ["s1", "s2"] }));

      expect(tx.appointment.update).toHaveBeenCalled();
    });

    it("rejects reviving a cancelled appointment by editing it", async () => {
      const { service } = setup({ appointment: { status: "cancelled" } });

      await expect(service.update(updateInput({ date: "2026-08-06", time: "11:00" }))).rejects.toThrow(
        "a cancelled appointment can't be updated",
      );
    });
  });

  describe("scoping", () => {
    // R20: a professional may only touch their own appointments.
    it("restricts the lookup to the caller's own appointments", async () => {
      const { service, tx } = setup();

      await service.update(updateInput({ date: "2026-08-06", time: "11:00", professionalScope: "p1" }));

      expect(tx.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "a1", tenantId: TENANT_ID, professionalId: "p1" } }),
      );
    });

    it("does not filter by professional for an owner", async () => {
      const { service, tx } = setup();

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(tx.appointment.findFirst.mock.calls[0]?.[0]?.where).not.toHaveProperty("professionalId");
    });

    it("answers 'not found' rather than 'not yours'", async () => {
      const { service, tx } = setup();
      tx.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.update(updateInput({ date: "2026-08-06", time: "11:00", professionalScope: "p2" })),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("the move", () => {
    it("recomputes end_at at the new start from the booked duration", async () => {
      const { service, tx } = setup({
        appointment: {
          services: [{ serviceId: "s1", position: 0, durationMinutes: 60, price: new Prisma.Decimal("45.00") }],
        },
      });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx).startAt.toISOString()).toBe("2026-08-06T07:00:00.000Z");
      expect(updatedData(tx).endAt.toISOString()).toBe("2026-08-06T08:00:00.000Z");
    });

    // The counterpart of the price rule below: a duration edit must not
    // retroactively re-length an appointment already on the books, or the slot
    // the picker offered and the block that gets written stop agreeing.
    it("does not re-length an appointment whose service duration changed since booking", async () => {
      const { service, tx } = setup({
        services: [{ ...defaultService, durationMinutes: 90 }],
        appointment: {
          services: [{ serviceId: "s1", position: 0, durationMinutes: 30, price: new Prisma.Decimal("45.00") }],
        },
      });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      // 30 minutes, as booked — not the service's current 90.
      expect(updatedData(tx).endAt.toISOString()).toBe("2026-08-06T07:30:00.000Z");
    });

    // R40: the price was snapshotted at creation; moving doesn't re-quote it.
    it("does not re-quote a moved appointment whose service price changed since booking", async () => {
      const { service, tx } = setup({
        services: [{ ...defaultService, price: new Prisma.Decimal("99.00") }],
      });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx).price.toString()).toBe("45");
    });

    it("rewrites no service lines when only the time moves", async () => {
      const { service, tx } = setup();

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(tx.appointmentService.deleteMany).not.toHaveBeenCalled();
      expect(tx.appointmentService.createMany).not.toHaveBeenCalled();
    });

    it("keeps the existing time when only the professional changes", async () => {
      const { service, tx } = setup({
        professionals: [
          { id: "p1", name: "Levan", isActive: true },
          { id: "p2", name: "Nino", isActive: true },
        ],
      });

      await service.update(updateInput({ professionalId: "p2" }));

      expect(updatedData(tx)).toMatchObject({ professionalId: "p2" });
      expect(updatedData(tx).startAt.toISOString()).toBe("2026-08-05T06:00:00.000Z");
    });

    // R80
    it("does not let the appointment conflict with itself", async () => {
      const { service, availability } = setup();

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(availability.findConflictsIn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ excludeAppointmentId: "a1" }),
      );
    });

    it("409s on a conflict and moves nothing", async () => {
      const { service, tx } = setup({ conflicts: [{ type: "time_off" }] });

      await expect(service.update(updateInput({ date: "2026-08-06", time: "11:00" }))).rejects.toThrow(
        ConflictException,
      );
      expect(tx.appointment.update).not.toHaveBeenCalled();
    });

    it("moves over a conflict once the caller confirms", async () => {
      const { service, tx, availability } = setup({ conflicts: [{ type: "time_off" }] });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00", override: true }));

      expect(availability.findConflictsIn).not.toHaveBeenCalled();
      expect(tx.appointment.update).toHaveBeenCalled();
    });
  });

  describe("deactivation", () => {
    // Deactivating a departing stylist must not strand the appointments
    // already on their calendar.
    it("still moves an appointment whose service was deactivated", async () => {
      const { service, tx } = setup({ services: [{ ...defaultService, isActive: false }] });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(tx.appointment.update).toHaveBeenCalled();
    });

    it("still moves an appointment whose professional was deactivated", async () => {
      const { service, tx } = setup({ professionals: [{ id: "p1", name: "Levan", isActive: false }] });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(tx.appointment.update).toHaveBeenCalled();
    });

    it("refuses to move an appointment onto a deactivated professional", async () => {
      const { service } = setup({
        professionals: [
          { id: "p1", name: "Levan", isActive: true },
          { id: "p2", name: "Nino", isActive: false },
        ],
      });

      await expect(service.update(updateInput({ professionalId: "p2" }))).rejects.toThrow(
        "Nino is deactivated and can't take new bookings",
      );
    });

    // R140 still applies to the new pairing.
    it("refuses to move an appointment onto a professional who doesn't perform the service", async () => {
      const { service } = setup({
        professionals: [
          { id: "p1", name: "Levan", isActive: true },
          { id: "p2", name: "Nino", isActive: true },
        ],
        assignments: [{ professionalId: "p1", serviceId: "s1" }],
      });

      await expect(service.update(updateInput({ professionalId: "p2" }))).rejects.toThrow(
        'Nino doesn\'t perform "Haircut"',
      );
    });

    // R120 governs new bookings, and adding a service to an appointment is one.
    it("refuses to add a deactivated service to an existing appointment", async () => {
      const { service } = setup({ services: [defaultService, { ...beardTrim, isActive: false }] });

      await expect(service.update(updateInput({ serviceIds: ["s1", "s2"] }))).rejects.toThrow(
        '"Beard trim" is deactivated and can\'t take new bookings',
      );
    });
  });

  describe("editing the service list", () => {
    it("replaces the lines wholesale rather than reordering them in place", async () => {
      const { service, tx } = setup({ services: [defaultService, beardTrim] });

      await service.update(updateInput({ serviceIds: ["s2", "s1"] }));

      // `@@unique(appointmentId, position)` is a plain index, so an in-place
      // swap would collide with itself mid-statement.
      expect(tx.appointmentService.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, appointmentId: "a1" },
      });
      expect(rewrittenLines(tx).map((line) => [line.serviceId, line.position])).toEqual([
        ["s2", 0],
        ["s1", 1],
      ]);
    });

    // R40 again, from the other direction: adding a service must not re-quote
    // the ones the customer was already told the price of.
    it("keeps an existing line's booked price while quoting the new one at today's", async () => {
      const { service, tx } = setup({
        services: [{ ...defaultService, price: new Prisma.Decimal("99.00") }, beardTrim],
      });

      await service.update(updateInput({ serviceIds: ["s1", "s2"] }));

      expect(rewrittenLines(tx).map((line) => line.price.toString())).toEqual(["45", "15"]);
      expect(updatedData(tx).price.toString()).toBe("60");
    });

    it("keeps an existing line's booked duration when another service is added", async () => {
      const { service, tx } = setup({
        services: [{ ...defaultService, durationMinutes: 90 }, beardTrim],
      });

      await service.update(updateInput({ serviceIds: ["s1", "s2"] }));

      // 30 as booked + 15 for the newly added trim, not 90 + 15.
      expect(rewrittenLines(tx).map((line) => line.durationMinutes)).toEqual([30, 15]);
      expect(updatedData(tx).endAt.toISOString()).toBe("2026-08-05T06:45:00.000Z");
    });

    it("re-totals the price when a service is removed", async () => {
      const { service, tx } = setup({
        services: [defaultService, beardTrim],
        appointment: {
          services: [
            { serviceId: "s1", position: 0, durationMinutes: 30, price: new Prisma.Decimal("45.00") },
            { serviceId: "s2", position: 1, durationMinutes: 15, price: new Prisma.Decimal("15.00") },
          ],
        },
      });

      await service.update(updateInput({ serviceIds: ["s2"] }));

      expect(updatedData(tx).price.toString()).toBe("15");
      expect(updatedData(tx).endAt.toISOString()).toBe("2026-08-05T06:15:00.000Z");
    });

    it("re-checks the window against the new, longer block", async () => {
      const { service, availability } = setup({ services: [defaultService, beardTrim] });

      await service.update(updateInput({ serviceIds: ["s1", "s2"] }));

      expect(availability.findConflictsIn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          startAt: new Date("2026-08-05T06:00:00.000Z"),
          endAt: new Date("2026-08-05T06:45:00.000Z"),
          excludeAppointmentId: "a1",
        }),
      );
    });

    it("rejects emptying the service list", async () => {
      const { service } = setup();

      await expect(service.update(updateInput({ serviceIds: [] }))).rejects.toThrow(
        "at least one serviceId is required",
      );
    });
  });

  describe("magic-link rotation", () => {
    // R110: a customer's link must never point at a stale time.
    it("rotates a customer booking's token and re-dates its expiry", async () => {
      const oldHash = "a".repeat(64);
      const { service, tx } = setup({ appointment: { accessTokenHash: oldHash } });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      const data = updatedData(tx);
      expect(data.accessTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(data.accessTokenHash).not.toBe(oldHash);
      // 24 hours past the new end_at (07:30Z on the 6th).
      expect(data.accessTokenExpiresAt?.toISOString()).toBe("2026-08-07T07:30:00.000Z");
    });

    it("issues a different token every time", async () => {
      const first = setup({ appointment: { accessTokenHash: "a".repeat(64) } });
      const second = setup({ appointment: { accessTokenHash: "a".repeat(64) } });

      await first.service.update(updateInput({ date: "2026-08-06", time: "11:00" }));
      await second.service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(first.tx).accessTokenHash).not.toBe(updatedData(second.tx).accessTokenHash);
    });

    // R70: a staff-created booking is tokenless and stays that way.
    it("leaves a staff-created booking without a token", async () => {
      const { service, tx } = setup();

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx)).not.toHaveProperty("accessTokenHash");
      expect(updatedData(tx)).not.toHaveProperty("accessTokenExpiresAt");
    });
  });
});
