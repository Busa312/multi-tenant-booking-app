import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import { BookingService } from "./booking.service.js";
import type { AvailabilityService } from "./availability.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const TZ = "Asia/Tbilisi";

type ServiceRow = {
  id: string;
  name: string;
  durationMinutes: number;
  price: Prisma.Decimal;
  isActive: boolean;
  priceFrom?: boolean;
};
type ProfessionalRow = { id: string; name: string; isActive: boolean; locationId?: string | null };
type LocationRow = { id: string; name: string; isActive: boolean };

type LineRow = { serviceId: string; position: number; durationMinutes: number; price: Prisma.Decimal; priceFrom?: boolean };
type AppointmentRow = {
  phoneNumber: string;
  id: string;
  tenantId: string;
  professionalId: string | null;
  locationId: string | null;
  startAt: Date;
  endAt: Date;
  status: string;
  visitId: string | null;
  services: LineRow[];
};

// R230: the customer's link lives on the visit
type VisitRow = { accessTokenHash: string | null; appointments: { endAt: Date }[] };

interface AppointmentWriteData {
  tenantId: string;
  professionalId: string | null;
  locationId: string | null;
  userName: string;
  phoneNumber: string;
  email: string;
  startAt: Date;
  endAt: Date;
  price: Prisma.Decimal;
  notes: string | null;
  createdByUserId: string | null;
  visitId?: string | null;
  services: { create: LineRow[] };
}

type WriteArgs = { data: AppointmentWriteData; include?: unknown };

interface Overrides {
  services?: ServiceRow[];
  professionals?: ProfessionalRow[];

  assignments?: { professionalId: string; serviceId: string }[];
  // R150: defaults to none
  locations?: LocationRow[];
  appointment?: Partial<AppointmentRow>;
  visit?: VisitRow | null;
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
  const locations = overrides.locations ?? [];
  const existing: AppointmentRow = {
    id: "a1",
    tenantId: TENANT_ID,
    professionalId: "p1",
    locationId: null,
    phoneNumber: "+995555123456",
    startAt: new Date("2026-08-05T06:00:00.000Z"),
    endAt: new Date("2026-08-05T06:30:00.000Z"),
    status: "booked",
    visitId: null,
    services: [{ serviceId: "s1", position: 0, durationMinutes: 30, price: new Prisma.Decimal("45.00") }],
    ...overrides.appointment,
  };

  const tx = {
    // R260: lockBookingDay
    $executeRaw: jest.fn().mockResolvedValue(1),
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: TZ }) },
    service: {
      findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(services.filter((row) => where.id.in.includes(row.id))),
      ),
    },
    professional: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) => {
        const row = professionals.find((candidate) => candidate.id === where.id);

        return Promise.resolve(row ? { locationId: null, ...row } : null);
      }),
    },
    location: {
      findMany: jest.fn().mockResolvedValue(locations),
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
      // R360: the customer's finished appointments, read when a conflict is reported
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(({ data }: WriteArgs) => Promise.resolve({ id: "new", ...data })),
      update: jest.fn(({ data }: WriteArgs) => Promise.resolve({ id: "a1", ...data })),
    },
    appointmentService: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    visit: {
      findFirst: jest.fn().mockResolvedValue(overrides.visit ?? null),
      update: jest.fn().mockResolvedValue({}),
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

const rewrittenLines = (tx: TxStub): LineRow[] => {
  const call = tx.appointmentService.createMany.mock.calls[0];
  if (!call) throw new Error("expected appointmentService.createMany to have been called");
  return call[0].data;
};

beforeEach(() => {
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

  // R70: staff-created bookings carry no customer link
  // R70: staff bookings have no link, so no visit
  it("creates a staff booking outside any visit, with no link", async () => {
    const { service, tx } = setup();

    const result = await service.create(createInput());

    expect(createdData(tx).visitId).toBeUndefined();
    expect(tx.visit.update).not.toHaveBeenCalled();
    expect(result.appointment).toBeDefined();
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

    // R520
    it("snapshots whether each line's price was a starting price", async () => {
      const design = { ...beardTrim, priceFrom: true };
      const { service, tx } = setup({ services: [{ ...defaultService, priceFrom: false }, design] });

      await service.create(createInput({ serviceIds: ["s1", "s2"] }));

      expect(createdData(tx).services.create.map((line) => line.priceFrom)).toEqual([false, true]);
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

    // R30: email is optional on the form but NOT NULL in the schema
    it("stores an empty string when no email is given", async () => {
      const { service, tx } = setup();

      await service.create(createInput());

      expect(createdData(tx).email).toBe("");
    });

    // R270: not collected any more, even if a client still sends one
    it("never stores an email", async () => {
      const { service, tx } = setup();

      await service.create(createInput({ email: "nino@example.com" }));

      expect(createdData(tx).email).toBe("");
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

    it("refuses a booking in the past", async () => {
      jest.setSystemTime(new Date("2026-08-05T09:00:00.000Z"));
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

    it("refuses a deactivated professional", async () => {
      const { service } = setup({ professionals: [{ id: "p1", name: "Levan", isActive: false }] });

      await expect(service.create(createInput())).rejects.toThrow(
        "Levan is deactivated and can't take new bookings",
      );
    });

    it("refuses a professional who doesn't perform the service", async () => {
      const { service } = setup({ assignments: [] });

      await expect(service.create(createInput())).rejects.toThrow('Levan doesn\'t perform "Haircut"');
    });

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

  // One customer however the number is typed: the canonical spelling is stored beside the typed one.
  it("stores the phone's canonical key next to the number as typed", async () => {
    const { service, tx } = setup();

    await service.create(createInput({ phoneNumber: "555 12 34 56" }));

    expect(createdData(tx)).toMatchObject({ phoneNumber: "555 12 34 56", phoneKey: "995555123456" });
  });

  describe("conflicts", () => {
    // R60: a conflict is a warning the caller must have seen
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
        noShowHistory: null,
      });
    });

    // R360: "book anyway" is decided knowing how this customer's last visits went
    it("names the customer's no-show history alongside the conflicts", async () => {
      const { service, tx } = setup({ conflicts: [{ type: "appointment" }] });
      tx.appointment.findMany.mockResolvedValue([
        { id: "h1", visitId: null, phoneKey: "995555123456", status: "no_show", startAt: new Date("2026-01-05T08:00:00Z") },
        { id: "h2", visitId: null, phoneKey: "995555123456", status: "completed", startAt: new Date("2026-01-12T08:00:00Z") },
      ]);

      const body = await service.create(createInput()).catch((error) => error.getResponse());

      expect(body.noShowHistory).toEqual({ missed: 1, of: 2 });
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

    // R260
    it("takes the tenant's lock for the booked day before checking", async () => {
      const { service, tx, availability } = setup();
      availability.findConflictsIn.mockImplementation(() => {
        expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
        return Promise.resolve([]);
      });

      await service.create(createInput());

      const [strings, key] = tx.$executeRaw.mock.calls[0] as [TemplateStringsArray, string];
      expect(strings.join("?")).toContain("pg_advisory_xact_lock");
      expect(key).toBe(`booking:${TENANT_ID}:2026-08-05`);
    });

    // R260 + R60: override skips the check, not the queue
    it("still takes the lock when booking over a conflict", async () => {
      const { service, tx } = setup();

      await service.create(createInput({ override: true }));

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    });
  });

  // R180: the rule is that a booking can never end up at a branch

  describe("locations", () => {
    const VAKE = { id: "loc-a", name: "Vake", isActive: true };
    const SABURTALO = { id: "loc-b", name: "Saburtalo", isActive: true };

    it("records null and asks for nothing when the tenant has no locations", async () => {
      const { service, tx } = setup();

      await service.create(createInput());

      expect(createdData(tx).locationId).toBeNull();
    });

    it("rejects a location from a tenant that has none", async () => {
      const { service } = setup();

      await expect(service.create(createInput({ locationId: "loc-a" }))).rejects.toThrow(
        "this business has no locations to book at",
      );
    });

    it("requires a location once the tenant has one, even with only one to pick", async () => {
      const { service, tx } = setup({ locations: [VAKE] });

      await expect(service.create(createInput())).rejects.toThrow(BadRequestException);
      expect(tx.appointment.create).not.toHaveBeenCalled();
    });

    it("records the chosen branch", async () => {
      const { service, tx } = setup({ locations: [VAKE, SABURTALO] });

      await service.create(createInput({ locationId: "loc-b" }));

      expect(createdData(tx).locationId).toBe("loc-b");
    });

    it("404s on a location id that isn't this tenant's", async () => {
      const { service } = setup({ locations: [VAKE] });

      await expect(service.create(createInput({ locationId: "loc-zzz" }))).rejects.toThrow(NotFoundException);
    });

    it("refuses a new booking at a closed branch", async () => {
      const { service } = setup({ locations: [{ ...SABURTALO, isActive: false }, VAKE] });

      await expect(service.create(createInput({ locationId: "loc-b" }))).rejects.toThrow(
        "Saburtalo is closed and can't take new bookings",
      );
    });

    it("refuses a professional who works at another branch, naming both", async () => {
      const { service } = setup({
        locations: [VAKE, SABURTALO],
        professionals: [{ id: "p1", name: "Levan", isActive: true, locationId: "loc-a" }],
      });

      await expect(service.create(createInput({ locationId: "loc-b" }))).rejects.toThrow(
        "Levan doesn't work at Saburtalo",
      );
    });

    it("accepts a professional based at every location, at any branch (R180)", async () => {
      const { service, tx } = setup({
        locations: [VAKE, SABURTALO],
        professionals: [{ id: "p1", name: "Levan", isActive: true, locationId: null }],
      });

      await service.create(createInput({ locationId: "loc-b" }));

      expect(createdData(tx).locationId).toBe("loc-b");
    });

    it("accepts 'any available' at a branch — there is no professional to contradict it", async () => {
      const { service, tx } = setup({ locations: [VAKE] });

      await service.create(createInput({ professionalId: null, locationId: "loc-a" }));

      expect(createdData(tx).locationId).toBe("loc-a");
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
        "an update must change the time, the professional, the location, the services, or some of them",
      );
    });

    it("accepts a services-only change", async () => {
      const { service, tx } = setup({ services: [defaultService, beardTrim] });

      await service.update(updateInput({ serviceIds: ["s1", "s2"] }));

      expect(tx.appointment.update).toHaveBeenCalled();
    });

    // R520
    it("keeps a line booked at a starting price as one, even after the service's price stops being one", async () => {
      const { service, tx } = setup({
        services: [{ ...defaultService, priceFrom: false }, { ...beardTrim, priceFrom: false }],
        appointment: { services: [{ serviceId: "s1", position: 0, durationMinutes: 30, price: new Prisma.Decimal("45.00"), priceFrom: true }] },
      });

      await service.update(updateInput({ serviceIds: ["s1", "s2"] }));

      expect(rewrittenLines(tx).map((line) => [line.serviceId, line.priceFrom])).toEqual([
        ["s1", true],
        ["s2", false],
      ]);
    });

    it("rejects reviving a cancelled appointment by editing it", async () => {
      const { service } = setup({ appointment: { status: "cancelled" } });

      await expect(service.update(updateInput({ date: "2026-08-06", time: "11:00" }))).rejects.toThrow(
        "a cancelled appointment can't be updated",
      );
    });
  });

  // R610: a move to a new time gets its own reminder and needs confirming again
  describe("reminders", () => {
    const updatedData = (tx: { appointment: { update: jest.Mock } }) =>
      (tx.appointment.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;

    it("clears the reminder and the confirmation when the time changes", async () => {
      const { service, tx } = setup();

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx)).toMatchObject({ reminderSentAt: null, confirmedAt: null });
    });

    it("keeps them when only the services change, at the same time", async () => {
      const { service, tx } = setup({ services: [defaultService, beardTrim] });

      await service.update(updateInput({ serviceIds: ["s1", "s2"] }));

      expect(updatedData(tx)).not.toHaveProperty("reminderSentAt");
      expect(updatedData(tx)).not.toHaveProperty("confirmedAt");
    });
  });

  describe("scoping", () => {
    // R20: a professional may only touch their own appointments
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

    it("does not re-length an appointment whose service duration changed since booking", async () => {
      const { service, tx } = setup({
        services: [{ ...defaultService, durationMinutes: 90 }],
        appointment: {
          services: [{ serviceId: "s1", position: 0, durationMinutes: 30, price: new Prisma.Decimal("45.00") }],
        },
      });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx).endAt.toISOString()).toBe("2026-08-06T07:30:00.000Z");
    });

    // R40: the price was snapshotted at creation
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

    // R260: a move can only create a conflict on the day it lands on
    it("locks the day the appointment moves to", async () => {
      const { service, tx } = setup();

      await service.update(updateInput({ date: "2026-08-09", time: "11:00" }));

      expect(tx.$executeRaw.mock.calls[0]?.[1]).toBe(`booking:${TENANT_ID}:2026-08-09`);
    });

    it("locks the appointment's own local day when only the professional changes", async () => {
      const { service, tx } = setup({
        professionals: [
          { id: "p1", name: "Levan", isActive: true },
          { id: "p2", name: "Nino", isActive: true },
        ],
      });

      await service.update(updateInput({ professionalId: "p2" }));

      expect(tx.$executeRaw.mock.calls[0]?.[1]).toBe(`booking:${TENANT_ID}:2026-08-05`);
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

      expect(tx.appointmentService.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, appointmentId: "a1" },
      });
      expect(rewrittenLines(tx).map((line) => [line.serviceId, line.position])).toEqual([
        ["s2", 0],
        ["s1", 1],
      ]);
    });

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

  describe("customer link on a staff move", () => {
    // The moved segment now ends at 07:30Z; the visit's other live segment ends earlier.
    const customerVisit = (): Overrides => ({
      appointment: { visitId: "v1" },
      visit: {
        accessTokenHash: "a".repeat(64),
        appointments: [{ endAt: new Date("2026-08-06T06:30:00.000Z") }, { endAt: new Date("2026-08-06T07:30:00.000Z") }],
      },
    });
    const visitWrite = (tx: TxStub) => {
      const call = tx.visit.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }] | undefined;
      if (!call) throw new Error("expected visit.update to have been called");
      return call[0].data;
    };

    // R230: the link the customer was texted keeps working after staff move them
    it("keeps the token and moves its expiry to a day after the visit's last segment", async () => {
      const { service, tx } = setup(customerVisit());

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(visitWrite(tx)).toEqual({ accessTokenExpiresAt: new Date("2026-08-07T07:30:00.000Z") });
    });

    // R70: a staff-created booking is tokenless and stays that way
    it("leaves a staff-created booking without a link", async () => {
      const { service, tx } = setup();

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(tx.visit.update).not.toHaveBeenCalled();
    });

    it("doesn't resurrect the link of a visit the customer cancelled", async () => {
      const { service, tx } = setup({ appointment: { visitId: "v1" }, visit: { accessTokenHash: null, appointments: [] } });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(tx.visit.update).not.toHaveBeenCalled();
    });
  });

  describe("locations", () => {
    const VAKE = { id: "loc-a", name: "Vake", isActive: true };
    const SABURTALO = { id: "loc-b", name: "Saburtalo", isActive: true };

    it("keeps the branch it is already at when the update doesn't mention one", async () => {
      const { service, tx } = setup({
        locations: [VAKE, SABURTALO],
        appointment: { locationId: "loc-b" },
      });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx).locationId).toBe("loc-b");
    });

    it("moves the appointment to another branch", async () => {
      const { service, tx } = setup({
        locations: [VAKE, SABURTALO],
        appointment: { locationId: "loc-a" },
      });

      await service.update(updateInput({ locationId: "loc-b" }));

      expect(updatedData(tx).locationId).toBe("loc-b");
    });

    it("refuses a professional change that strands the appointment at its branch", async () => {
      const { service } = setup({
        locations: [VAKE, SABURTALO],
        professionals: [
          { id: "p1", name: "Levan", isActive: true, locationId: "loc-a" },
          { id: "p2", name: "Nino", isActive: true, locationId: "loc-b" },
        ],
        appointment: { locationId: "loc-a" },
      });

      await expect(service.update(updateInput({ professionalId: "p2" }))).rejects.toThrow(
        "Nino doesn't work at Vake",
      );
    });

    it("still lets an appointment already at a closed branch be moved in time", async () => {
      const { service, tx } = setup({
        locations: [{ ...VAKE, isActive: false }, SABURTALO],
        appointment: { locationId: "loc-a" },
      });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx).locationId).toBe("loc-a");
    });

    it("keeps an appointment booked before the tenant had locations reschedulable", async () => {
      // Its location_id is null and the update says nothing about a branch;
      // demanding one here would strand every row predating the first location.
      const { service, tx } = setup({
        locations: [VAKE, SABURTALO],
        appointment: { locationId: null },
      });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx).locationId).toBeNull();
    });

    it("still lets such an appointment be moved to a branch deliberately", async () => {
      const { service, tx } = setup({
        locations: [VAKE, SABURTALO],
        appointment: { locationId: null },
      });

      await service.update(updateInput({ locationId: "loc-a" }));

      expect(updatedData(tx).locationId).toBe("loc-a");
    });

    it("lets a re-time through after the stylist was reassigned to another branch", async () => {
      // Neither side of the pairing is changing, so the appointment on their
      // old branch's books must not be frozen by the reassignment.
      const { service, tx } = setup({
        locations: [VAKE, SABURTALO],
        professionals: [{ id: "p1", name: "Levan", isActive: true, locationId: "loc-b" }],
        appointment: { locationId: "loc-a" },
      });

      await service.update(updateInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx).locationId).toBe("loc-a");
    });

    it("refuses moving an appointment *to* a closed branch", async () => {
      const { service } = setup({
        locations: [VAKE, { ...SABURTALO, isActive: false }],
        appointment: { locationId: "loc-a" },
      });

      await expect(service.update(updateInput({ locationId: "loc-b" }))).rejects.toThrow(BadRequestException);
    });
  });
});
