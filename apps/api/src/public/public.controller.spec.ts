import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import { PublicController } from "./public.controller.js";
import { hashToken, type BookingService } from "../booking/booking.service.js";
import type { AvailabilityService } from "../booking/availability.service.js";
import type { NotificationService } from "../notifications/notification.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { RedisService } from "../redis/redis.service.js";
import type { VerificationService } from "./verification.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const TOKEN = "a".repeat(64);
const HOST = "acme.platform.ge";

const NOW = new Date("2026-08-05T00:00:00.000Z");
const FUTURE = new Date("2026-08-06T00:00:00.000Z");
const PAST = new Date("2026-08-04T00:00:00.000Z");

interface Overrides {
  appointment?: Record<string, unknown> | null;

  counters?: number[];
  upcoming?: Record<string, unknown>[];
  reissued?: string | null;
}

const appointmentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "a1",
  tenantId: TENANT_ID,
  services: [],
  professionalId: "p1",
  locationId: null,
  userName: "ნინო",
  phoneNumber: "+995555123456",
  email: "nino@example.com",
  startAt: FUTURE,
  endAt: FUTURE,
  price: new Prisma.Decimal("45.00"),
  status: "booked",
  accessTokenHash: hashToken(TOKEN),
  accessTokenExpiresAt: FUTURE,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const setup = (overrides: Overrides = {}) => {
  const tx = {
    appointment: {
      findFirst: jest
        .fn()
        .mockResolvedValue(overrides.appointment === undefined ? appointmentRow() : overrides.appointment),
      findMany: jest.fn().mockResolvedValue(overrides.upcoming ?? []),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(appointmentRow({ ...data })),
      ),
    },
  };

  const prisma = {
    forTenant: jest.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      fn(tx as unknown as Prisma.TransactionClient),
    ),
  } as unknown as PrismaService;

  const tenantContext = {
    current: { tenantId: TENANT_ID, host: HOST, protocol: "https" as const },
  } as unknown as TenantContextService;

  const booking = {
    create: jest.fn().mockResolvedValue({ appointment: appointmentRow(), magicLinkToken: "issued" }),
    update: jest.fn().mockResolvedValue({ appointment: appointmentRow(), magicLinkToken: "rotated" }),
    reissueToken: jest.fn().mockResolvedValue({
      magicLinkToken: overrides.reissued === undefined ? "fresh" : overrides.reissued,
    }),
  };
  const notifications = {
    sendMagicLink: jest.fn().mockResolvedValue(undefined),
    // Mocked delivery: false means "not sent", which is what makes the
    // controller hand the code back on the response.
    sendOtp: jest.fn().mockResolvedValue(false),
  };
  const verification = {
    start: jest.fn().mockResolvedValue({ expiresAt: FUTURE, devCode: "123456" }),
    verify: jest.fn().mockResolvedValue("verification-token"),
    consume: jest.fn().mockResolvedValue(undefined),
  };

  const counters = overrides.counters ?? [];
  let call = 0;
  const redis = {
    client: {
      incr: jest.fn(() => Promise.resolve(counters[call++] ?? 1)),
      expire: jest.fn().mockResolvedValue(1),
    },
  } as unknown as RedisService;

  const controller = new PublicController(
    prisma,
    tenantContext,
    {} as unknown as AvailabilityService,
    booking as unknown as BookingService,
    notifications as unknown as NotificationService,
    redis,
    verification as unknown as VerificationService,
  );

  return { controller, tx, booking, notifications, redis, verification };
};

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("magic-link lookup", () => {
  it("returns the appointment for a live token", async () => {
    const { controller } = setup();

    await expect(controller.getAppointmentByToken(TOKEN)).resolves.toMatchObject({ id: "a1" });
  });

  it("looks the token up by hash, never by its plaintext", async () => {
    const { controller, tx } = setup();

    await controller.getAppointmentByToken(TOKEN);

    const where = tx.appointment.findFirst.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.accessTokenHash).toBe(hashToken(TOKEN));
    expect(JSON.stringify(where)).not.toContain(TOKEN);
  });

  it("scopes the lookup to the tenant, so a token is useless on another tenant's domain", async () => {
    const { controller, tx } = setup();

    await controller.getAppointmentByToken(TOKEN);

    expect(tx.appointment.findFirst.mock.calls[0]?.[0]?.where).toMatchObject({ tenantId: TENANT_ID });
  });

  it.each([
    ["an unknown token", { appointment: null }],
    ["an expired token", { appointment: appointmentRow({ accessTokenExpiresAt: PAST }) }],
    ["a cancelled booking whose token was cleared", { appointment: appointmentRow({ accessTokenExpiresAt: null }) }],
  ])("answers identically for %s", async (_label, override) => {
    const { controller } = setup(override as Overrides);

    await expect(controller.getAppointmentByToken(TOKEN)).rejects.toThrow(NotFoundException);
    await expect(controller.getAppointmentByToken(TOKEN)).rejects.toThrow("This link is no longer valid");
  });

  it("refuses an empty token without going to the database", async () => {
    const { controller, tx } = setup();

    await expect(controller.getAppointmentByToken("")).rejects.toThrow("This link is no longer valid");
    expect(tx.appointment.findFirst).not.toHaveBeenCalled();
  });
});

describe("cancel", () => {
  it("keeps the row as history and kills the link (R90)", async () => {
    const { controller, tx } = setup();

    await controller.cancelAppointment(TOKEN);

    const data = tx.appointment.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.status).toBe("cancelled");

    expect(data.accessTokenHash).toBeNull();
    expect(data.accessTokenExpiresAt).toBeNull();
  });

  it("is idempotent — a second click is not an error", async () => {
    const { controller, tx } = setup({ appointment: appointmentRow({ status: "cancelled" }) });

    await expect(controller.cancelAppointment(TOKEN)).resolves.toMatchObject({ status: "cancelled" });
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });
});

describe("reschedule", () => {
  it("sends the customer their rotated link (R110)", async () => {
    const { controller, notifications } = setup();

    await controller.rescheduleAppointment(TOKEN, { date: "2026-08-07", time: "11:00" });

    expect(notifications.sendMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({ manageUrl: "https://acme.platform.ge/manage/rotated" }),
    );
  });

  it("moves only the time — never the professional, services or branch", async () => {
    const { controller, booking } = setup();

    await controller.rescheduleAppointment(TOKEN, { date: "2026-08-07", time: "11:00" });

    const input = booking.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(input).toMatchObject({ appointmentId: "a1", date: "2026-08-07", time: "11:00" });
    expect(input).not.toHaveProperty("serviceIds");
    expect(input).not.toHaveProperty("locationId");
    expect(input.professionalId).toBeUndefined();
  });
});

describe("resend", () => {
  it("resolves the same way whether or not anything matched", async () => {
    const hit = setup({ upcoming: [appointmentRow()] });
    const miss = setup({ upcoming: [] });

    await expect(hit.controller.resendMagicLink({ phoneNumber: "+995555123456" })).resolves.toBeUndefined();
    await expect(miss.controller.resendMagicLink({ phoneNumber: "+995000000000" })).resolves.toBeUndefined();
  });

  it("mints a new link rather than trying to recover the old one", async () => {
    const { controller, booking, notifications } = setup({ upcoming: [appointmentRow()] });

    await controller.resendMagicLink({ phoneNumber: "+995555123456" });

    expect(booking.reissueToken).toHaveBeenCalledWith("a1");
    expect(notifications.sendMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({ manageUrl: "https://acme.platform.ge/manage/fresh" }),
    );
  });

  it("only considers upcoming, live-token, non-cancelled bookings", async () => {
    const { controller, tx } = setup();

    await controller.resendMagicLink({ phoneNumber: "+995555123456" });

    const where = tx.appointment.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where).toMatchObject({
      tenantId: TENANT_ID,
      phoneNumber: "+995555123456",
      status: { not: "cancelled" },
      accessTokenHash: { not: null },
    });
    expect(where.startAt).toEqual({ gt: NOW });
  });

  it("stops sending past the per-phone limit, still without saying so", async () => {
    const { controller, notifications } = setup({ counters: [4, 4], upcoming: [appointmentRow()] });

    await expect(controller.resendMagicLink({ phoneNumber: "+995555123456" })).resolves.toBeUndefined();
    expect(notifications.sendMagicLink).not.toHaveBeenCalled();
  });

  it("does not spend the tenant budget on a number that is already blocked", async () => {
    // Otherwise one caller hammering a single number exhausts the hourly tenant
    // allowance and locks every other customer out of link recovery.
    const { controller, redis } = setup({ counters: [4], upcoming: [appointmentRow()] });

    await controller.resendMagicLink({ phoneNumber: "+995555123456" });

    expect(redis.client.incr).toHaveBeenCalledTimes(1);
  });

  it("stops on the per-tenant limit even when each number is fresh", async () => {
    const { controller, notifications } = setup({ counters: [1, 31], upcoming: [appointmentRow()] });

    await controller.resendMagicLink({ phoneNumber: "+995555000001" });

    expect(notifications.sendMagicLink).not.toHaveBeenCalled();
  });

  it("expires the counter only on first use, so the window can't be held open", async () => {
    const { controller, redis } = setup({ counters: [1, 2] });

    await controller.resendMagicLink({ phoneNumber: "+995555123456" });

    expect(redis.client.expire).toHaveBeenCalledTimes(1);
  });

  it("lets requests through when Redis is down rather than breaking recovery", async () => {
    const { controller, notifications, redis } = setup({ upcoming: [appointmentRow()] });
    (redis.client.incr as jest.Mock).mockRejectedValue(new Error("connection refused"));

    await controller.resendMagicLink({ phoneNumber: "+995555123456" });

    expect(notifications.sendMagicLink).toHaveBeenCalled();
  });

  it("ignores a blank phone number without touching Redis or the database", async () => {
    const { controller, tx, redis } = setup();

    await controller.resendMagicLink({ phoneNumber: "   " });

    expect(redis.client.incr).not.toHaveBeenCalled();
    expect(tx.appointment.findMany).not.toHaveBeenCalled();
  });
});

/**
 * R30: an email is optional on the public form, exactly as it is for a booking
 * staff take by phone. The rule these pin is that the booking always succeeds
 * and always yields a link — only the *delivery* depends on an address.
 */
describe("booking without an email", () => {
  const bookingInput = (overrides: Record<string, unknown> = {}) => ({
    serviceIds: ["s1"],
    locationId: "loc-a",
    date: "2026-08-05",
    time: "11:00",
    userName: "Nino",
    phoneNumber: "+995555123456",
    verificationToken: "verification-token",
    ...overrides,
  });

  it("books with no email at all and still returns the link", async () => {
    const { controller, notifications } = setup();

    const result = await controller.createAppointment(bookingInput());

    expect(result.manageUrl).toBe("https://acme.platform.ge/manage/issued");
    expect(notifications.sendMagicLink).not.toHaveBeenCalled();
  });

  it("treats a blank email as absent rather than mailing nowhere", async () => {
    const { controller, notifications } = setup();

    await controller.createAppointment(bookingInput({ email: "   " }));

    expect(notifications.sendMagicLink).not.toHaveBeenCalled();
  });

  it("still emails the link when an address is given", async () => {
    const { controller, notifications } = setup();

    await controller.createAppointment(bookingInput({ email: " nino@example.com " }));

    expect(notifications.sendMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nino@example.com", manageUrl: "https://acme.platform.ge/manage/issued" }),
    );
  });

  it("leaves addressless bookings out of the resend lookup", async () => {
    // There is nothing to re-send to, and including them would mint a fresh
    // token that replaces the customer's only working link.
    const { controller, tx } = setup();

    await controller.resendMagicLink({ phoneNumber: "+995555123456" });

    const where = tx.appointment.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.email).toEqual({ not: "" });
  });
});

describe("phone verification gate", () => {
  const bookingInput = (overrides: Record<string, unknown> = {}) => ({
    serviceIds: ["s1"],
    locationId: "loc-a",
    date: "2026-08-05",
    time: "11:00",
    userName: "Nino",
    phoneNumber: "+995555123456",
    verificationToken: "verification-token",
    ...overrides,
  });

  it("consumes the token for the number being booked, before writing anything", async () => {
    const { controller, verification, booking } = setup();

    await controller.createAppointment(bookingInput());

    expect(verification.consume).toHaveBeenCalledWith("+995555123456", "verification-token");
    // noUncheckedIndexedAccess: both calls are asserted above, so these exist.
    const [consumedAt] = verification.consume.mock.invocationCallOrder;
    const [createdAt] = booking.create.mock.invocationCallOrder;
    expect(consumedAt).toBeDefined();
    expect(createdAt).toBeDefined();
    expect(consumedAt as number).toBeLessThan(createdAt as number);
  });

  it("never creates the appointment when the token is refused", async () => {
    const { controller, verification, booking } = setup();
    verification.consume.mockRejectedValue(new BadRequestException("nope"));

    await expect(controller.createAppointment(bookingInput())).rejects.toThrow(BadRequestException);
    expect(booking.create).not.toHaveBeenCalled();
  });

  it("hands the code back only while SMS delivery is mocked", async () => {
    const { controller, notifications } = setup();

    const started = await controller.startVerification({ phoneNumber: "+995555123456" });

    expect(notifications.sendOtp).toHaveBeenCalledWith({ phoneNumber: "+995555123456", code: "123456" });
    expect(started.devCode).toBe("123456");
  });

  it("withholds the code once a provider actually delivers it", async () => {
    const { controller, notifications } = setup();
    notifications.sendOtp.mockResolvedValue(true);

    const started = await controller.startVerification({ phoneNumber: "+995555123456" });

    expect(started.devCode).toBeNull();
  });
});
