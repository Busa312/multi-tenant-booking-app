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
type AppointmentRow = {
  id: string;
  tenantId: string;
  serviceId: string;
  professionalId: string | null;
  startAt: Date;
  endAt: Date;
  status: string;
  accessTokenHash: string | null;
};

/**
 * The `data` payload a Prisma write received. Every field is declared present
 * so assertions can read them without narrowing; the tests that care about a
 * field being *absent* (`price` on a reschedule) assert that at runtime with
 * `not.toHaveProperty`.
 */
interface AppointmentWriteData {
  tenantId: string;
  serviceId: string;
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
}

type WriteArgs = { data: AppointmentWriteData; include?: unknown };

interface Overrides {
  services?: ServiceRow[];
  professionals?: ProfessionalRow[];
  assignment?: unknown;
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

const setup = (overrides: Overrides = {}) => {
  const services = overrides.services ?? [defaultService];
  const professionals = overrides.professionals ?? [{ id: "p1", name: "Levan", isActive: true }];
  const existing: AppointmentRow = {
    id: "a1",
    tenantId: TENANT_ID,
    serviceId: "s1",
    professionalId: "p1",
    startAt: new Date("2026-08-05T06:00:00.000Z"),
    endAt: new Date("2026-08-05T06:30:00.000Z"),
    status: "booked",
    accessTokenHash: null,
    ...overrides.appointment,
  };

  const tx = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: TZ }) },
    service: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(services.find((row) => row.id === where.id) ?? null),
      ),
    },
    professional: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(professionals.find((row) => row.id === where.id) ?? null),
      ),
    },
    serviceProfessional: {
      findFirst: jest.fn().mockResolvedValue(overrides.assignment === undefined ? { serviceId: "s1" } : overrides.assignment),
    },
    appointment: {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn(({ data }: WriteArgs) => Promise.resolve({ id: "new", ...data })),
      update: jest.fn(({ data }: WriteArgs) => Promise.resolve({ id: "a1", ...data })),
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
  serviceId: "s1",
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
    expect(tx.appointment.create.mock.calls[0]?.[0]?.include).toHaveProperty("service");
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
      const { service } = setup({ assignment: null });

      await expect(service.create(createInput())).rejects.toThrow('Levan doesn\'t perform "Haircut"');
    });

    it("skips the professional checks for an 'any available' booking", async () => {
      const { service, tx } = setup({ assignment: null });

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

describe("BookingService.reschedule", () => {
  const rescheduleInput = (overrides: Record<string, unknown> = {}) => ({
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

      await expect(service.reschedule(rescheduleInput(patch))).rejects.toThrow(
        "date and time must be sent together",
      );
    });

    it("rejects a no-op reschedule", async () => {
      const { service } = setup();

      await expect(service.reschedule(rescheduleInput())).rejects.toThrow(
        "a reschedule must change the time, the professional, or both",
      );
    });

    it("rejects reviving a cancelled appointment by moving it", async () => {
      const { service } = setup({ appointment: { status: "cancelled" } });

      await expect(service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }))).rejects.toThrow(
        "a cancelled appointment can't be rescheduled",
      );
    });
  });

  describe("scoping", () => {
    // R20: a professional may only touch their own appointments.
    it("restricts the lookup to the caller's own appointments", async () => {
      const { service, tx } = setup();

      await service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00", professionalScope: "p1" }));

      expect(tx.appointment.findFirst).toHaveBeenCalledWith({
        where: { id: "a1", tenantId: TENANT_ID, professionalId: "p1" },
      });
    });

    it("does not filter by professional for an owner", async () => {
      const { service, tx } = setup();

      await service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }));

      expect(tx.appointment.findFirst.mock.calls[0]?.[0]?.where).not.toHaveProperty("professionalId");
    });

    it("answers 'not found' rather than 'not yours'", async () => {
      const { service, tx } = setup();
      tx.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00", professionalScope: "p2" })),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("the move", () => {
    it("recomputes end_at from the service duration at the new start", async () => {
      const { service, tx } = setup({ services: [{ ...defaultService, durationMinutes: 60 }] });

      await service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx).startAt.toISOString()).toBe("2026-08-06T07:00:00.000Z");
      expect(updatedData(tx).endAt.toISOString()).toBe("2026-08-06T08:00:00.000Z");
    });

    // R40: the price was snapshotted at creation; moving doesn't re-quote it.
    it("never rewrites the price", async () => {
      const { service, tx } = setup();

      await service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx)).not.toHaveProperty("price");
    });

    it("keeps the existing time when only the professional changes", async () => {
      const { service, tx } = setup({
        professionals: [
          { id: "p1", name: "Levan", isActive: true },
          { id: "p2", name: "Nino", isActive: true },
        ],
      });

      await service.reschedule(rescheduleInput({ professionalId: "p2" }));

      expect(updatedData(tx)).toMatchObject({ professionalId: "p2" });
      expect(updatedData(tx).startAt.toISOString()).toBe("2026-08-05T06:00:00.000Z");
    });

    // R80
    it("does not let the appointment conflict with itself", async () => {
      const { service, availability } = setup();

      await service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }));

      expect(availability.findConflictsIn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ excludeAppointmentId: "a1" }),
      );
    });

    it("409s on a conflict and moves nothing", async () => {
      const { service, tx } = setup({ conflicts: [{ type: "time_off" }] });

      await expect(service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }))).rejects.toThrow(
        ConflictException,
      );
      expect(tx.appointment.update).not.toHaveBeenCalled();
    });

    it("moves over a conflict once the caller confirms", async () => {
      const { service, tx, availability } = setup({ conflicts: [{ type: "time_off" }] });

      await service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00", override: true }));

      expect(availability.findConflictsIn).not.toHaveBeenCalled();
      expect(tx.appointment.update).toHaveBeenCalled();
    });
  });

  describe("deactivation", () => {
    // Deactivating a departing stylist must not strand the appointments
    // already on their calendar.
    it("still moves an appointment whose service was deactivated", async () => {
      const { service, tx } = setup({ services: [{ ...defaultService, isActive: false }] });

      await service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }));

      expect(tx.appointment.update).toHaveBeenCalled();
    });

    it("still moves an appointment whose professional was deactivated", async () => {
      const { service, tx } = setup({ professionals: [{ id: "p1", name: "Levan", isActive: false }] });

      await service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }));

      expect(tx.appointment.update).toHaveBeenCalled();
    });

    it("refuses to move an appointment onto a deactivated professional", async () => {
      const { service } = setup({
        professionals: [
          { id: "p1", name: "Levan", isActive: true },
          { id: "p2", name: "Nino", isActive: false },
        ],
      });

      await expect(service.reschedule(rescheduleInput({ professionalId: "p2" }))).rejects.toThrow(
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
        assignment: null,
      });

      await expect(service.reschedule(rescheduleInput({ professionalId: "p2" }))).rejects.toThrow(
        'Nino doesn\'t perform "Haircut"',
      );
    });
  });

  describe("magic-link rotation", () => {
    // R110: a customer's link must never point at a stale time.
    it("rotates a customer booking's token and re-dates its expiry", async () => {
      const oldHash = "a".repeat(64);
      const { service, tx } = setup({ appointment: { accessTokenHash: oldHash } });

      await service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }));

      const data = updatedData(tx);
      expect(data.accessTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(data.accessTokenHash).not.toBe(oldHash);
      // 24 hours past the new end_at (07:30Z on the 6th).
      expect(data.accessTokenExpiresAt?.toISOString()).toBe("2026-08-07T07:30:00.000Z");
    });

    it("issues a different token every time", async () => {
      const first = setup({ appointment: { accessTokenHash: "a".repeat(64) } });
      const second = setup({ appointment: { accessTokenHash: "a".repeat(64) } });

      await first.service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }));
      await second.service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(first.tx).accessTokenHash).not.toBe(updatedData(second.tx).accessTokenHash);
    });

    // R70: a staff-created booking is tokenless and stays that way.
    it("leaves a staff-created booking without a token", async () => {
      const { service, tx } = setup();

      await service.reschedule(rescheduleInput({ date: "2026-08-06", time: "11:00" }));

      expect(updatedData(tx)).not.toHaveProperty("accessTokenHash");
      expect(updatedData(tx)).not.toHaveProperty("accessTokenExpiresAt");
    });
  });
});
