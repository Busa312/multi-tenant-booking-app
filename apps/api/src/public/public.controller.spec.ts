import { BadRequestException, ConflictException, HttpException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Prisma } from "../../generated/prisma/index.js";
import { PublicController, visitorIp } from "./public.controller.js";
import { HoldLimitError } from "../booking/visit.service.js";
import type { AvailabilityService } from "../booking/availability.service.js";
import type { VisitService } from "../booking/visit.service.js";
import type { NotificationService } from "../notifications/notification.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { RedisService } from "../redis/redis.service.js";
import type { VerificationService } from "./verification.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

// The visit rules themselves (token lookup, cancel, reschedule, create) are
// pinned in booking/visit.service.spec.ts. This file covers what the
// controller still owns: resend rate limiting, email delivery, the phone
// verification gate, and parsing the availability query.

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const TOKEN = "a".repeat(64);
const HOST = "acme.platform.ge";
const HOLD = "22222222-2222-2222-2222-222222222222";

const NOW = new Date("2026-08-05T00:00:00.000Z");
const FUTURE = new Date("2026-08-06T00:00:00.000Z");

interface Overrides {
  counters?: number[];
  resendable?: unknown[];
  reissued?: string | null;
}

const segmentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "a1",
  tenantId: TENANT_ID,
  visitId: "v1",
  services: [],
  professionalId: "p1",
  professional: { name: "Nina" },
  locationId: null,
  location: null,
  userName: "ნინო",
  phoneNumber: "+995555123456",
  email: "nino@example.com",
  startAt: FUTURE,
  endAt: FUTURE,
  price: new Prisma.Decimal("45.00"),
  status: "booked",
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const visitRow = (segment: Record<string, unknown> = {}) => ({
  id: "v1",
  tenantId: TENANT_ID,
  accessTokenHash: "hash",
  accessTokenExpiresAt: FUTURE,
  createdAt: NOW,
  updatedAt: NOW,
  appointments: [segmentRow(segment)],
});

const setup = (overrides: Overrides = {}) => {
  const prisma = {
    forTenant: jest.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      fn({} as unknown as Prisma.TransactionClient),
    ),
  } as unknown as PrismaService;

  const tenantContext = {
    current: { tenantId: TENANT_ID, host: HOST, protocol: "https" as const },
  } as unknown as TenantContextService;

  const availability = { computeVisitSlots: jest.fn().mockResolvedValue([]) };
  const visits = {
    create: jest.fn().mockResolvedValue({ visit: visitRow(), magicLinkToken: "issued" }),
    getByToken: jest.fn().mockResolvedValue(visitRow()),
    reschedule: jest.fn().mockResolvedValue({ visit: visitRow(), magicLinkToken: "rotated" }),
    cancel: jest.fn().mockResolvedValue(visitRow({ status: "cancelled" })),
    findResendable: jest.fn().mockResolvedValue(overrides.resendable ?? []),
    reissue: jest.fn().mockResolvedValue(overrides.reissued === undefined ? "fresh" : overrides.reissued),
    hold: jest.fn().mockResolvedValue({ holdId: HOLD, expiresAt: FUTURE, slot: { startAt: "x", endAt: "y", segments: [] } }),
    release: jest.fn().mockResolvedValue(undefined),
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
    availability as unknown as AvailabilityService,
    visits as unknown as VisitService,
    notifications as unknown as NotificationService,
    redis,
    verification as unknown as VerificationService,
  );

  return { controller, availability, visits, notifications, redis, verification };
};

const bookingInput = (overrides: Record<string, unknown> = {}) => ({
  serviceIds: ["s1"],
  professionalIds: ["any"],
  locationId: "loc-a",
  date: "2026-08-05",
  time: "11:00",
  userName: "Nino",
  phoneNumber: "+995555123456",
  verificationToken: "verification-token",
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

// R200: positions matter — the Nth entry is the professional for the Nth service
describe("availability query", () => {
  it("keeps per-service choices aligned, reading \"any\" as no preference", async () => {
    const { controller, availability } = setup();

    await controller.getAvailability({
      serviceIds: "s1,s2,s3" as unknown as string[],
      professionalIds: "any,p2,any" as unknown as string[],
      date: "2026-08-05",
    });

    expect(availability.computeVisitSlots).toHaveBeenCalledWith(
      expect.objectContaining({ serviceIds: ["s1", "s2", "s3"], professionalIds: [null, "p2", null] }),
    );
  });

  it("treats an omitted list as no preference for every service", async () => {
    const { controller, availability } = setup();

    await controller.getAvailability({ serviceIds: "s1,s2" as unknown as string[], date: "2026-08-05" });

    expect(availability.computeVisitSlots).toHaveBeenCalledWith(
      expect.objectContaining({ professionalIds: [null, null] }),
    );
  });
});

describe("manage", () => {
  it("returns the visit behind the token", async () => {
    const { controller, visits } = setup();

    await expect(controller.getAppointmentByToken(TOKEN)).resolves.toMatchObject({ id: "v1", status: "booked" });
    expect(visits.getByToken).toHaveBeenCalledWith(TOKEN);
  });

  // R110: the old link dies the moment the move succeeds
  it("sends the customer their rotated link after a reschedule", async () => {
    const { controller, notifications } = setup();

    const result = await controller.rescheduleAppointment(TOKEN, { date: "2026-08-07", time: "11:00" });

    expect(result.manageUrl).toBe("https://acme.platform.ge/manage/rotated");
    expect(notifications.sendMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nino@example.com", manageUrl: "https://acme.platform.ge/manage/rotated" }),
    );
  });

  it("passes only the new time — never professionals, services or branch", async () => {
    const { controller, visits } = setup();

    await controller.rescheduleAppointment(TOKEN, { date: "2026-08-07", time: "11:00" });

    expect(visits.reschedule).toHaveBeenCalledWith(TOKEN, "2026-08-07", "11:00");
  });
});

describe("resend", () => {
  const resendable = [visitRow()];

  it("resolves the same way whether or not anything matched", async () => {
    const hit = setup({ resendable });
    const miss = setup({ resendable: [] });

    await expect(hit.controller.resendMagicLink({ phoneNumber: "+995555123456" })).resolves.toBeUndefined();
    await expect(miss.controller.resendMagicLink({ phoneNumber: "+995000000000" })).resolves.toBeUndefined();
  });

  it("mints a new link per visit rather than trying to recover the old one", async () => {
    const { controller, visits, notifications } = setup({ resendable });

    await controller.resendMagicLink({ phoneNumber: "+995555123456" });

    expect(visits.findResendable).toHaveBeenCalledWith("+995555123456");
    expect(visits.reissue).toHaveBeenCalledWith("v1");
    expect(notifications.sendMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({ manageUrl: "https://acme.platform.ge/manage/fresh" }),
    );
  });

  it("sends nothing when the link couldn't be reissued", async () => {
    const { controller, notifications } = setup({ resendable, reissued: null });

    await controller.resendMagicLink({ phoneNumber: "+995555123456" });

    expect(notifications.sendMagicLink).not.toHaveBeenCalled();
  });

  it("stops sending past the per-phone limit, still without saying so", async () => {
    const { controller, notifications } = setup({ counters: [4, 4], resendable });

    await expect(controller.resendMagicLink({ phoneNumber: "+995555123456" })).resolves.toBeUndefined();
    expect(notifications.sendMagicLink).not.toHaveBeenCalled();
  });

  it("does not spend the tenant budget on a number that is already blocked", async () => {
    // Otherwise one caller hammering a single number exhausts the hourly tenant
    // allowance and locks every other customer out of link recovery.
    const { controller, redis } = setup({ counters: [4], resendable });

    await controller.resendMagicLink({ phoneNumber: "+995555123456" });

    expect(redis.client.incr).toHaveBeenCalledTimes(1);
  });

  it("stops on the per-tenant limit even when each number is fresh", async () => {
    const { controller, notifications } = setup({ counters: [1, 31], resendable });

    await controller.resendMagicLink({ phoneNumber: "+995555000001" });

    expect(notifications.sendMagicLink).not.toHaveBeenCalled();
  });

  it("expires the counter only on first use, so the window can't be held open", async () => {
    const { controller, redis } = setup({ counters: [1, 2] });

    await controller.resendMagicLink({ phoneNumber: "+995555123456" });

    expect(redis.client.expire).toHaveBeenCalledTimes(1);
  });

  it("lets requests through when Redis is down rather than breaking recovery", async () => {
    const { controller, notifications, redis } = setup({ resendable });
    (redis.client.incr as jest.Mock).mockRejectedValue(new Error("connection refused"));

    await controller.resendMagicLink({ phoneNumber: "+995555123456" });

    expect(notifications.sendMagicLink).toHaveBeenCalled();
  });

  it("ignores a blank phone number without touching Redis or the database", async () => {
    const { controller, visits, redis } = setup();

    await controller.resendMagicLink({ phoneNumber: "   " });

    expect(redis.client.incr).not.toHaveBeenCalled();
    expect(visits.findResendable).not.toHaveBeenCalled();
  });
});

/**
 * R30: an email is optional on the public form, exactly as it is for a booking
 * staff take by phone. The rule these pin is that the booking always succeeds
 * and always yields a link — only the *delivery* depends on an address.
 */
describe("booking without an email", () => {
  it("books with no email at all and still returns the link", async () => {
    const { controller, notifications } = setup();

    const result = await controller.createAppointment(bookingInput());

    expect(result.manageUrl).toBe("https://acme.platform.ge/manage/issued");
    expect(notifications.sendMagicLink).not.toHaveBeenCalled();
  });

  it("treats a blank email as absent rather than mailing nowhere", async () => {
    const { controller, notifications, visits } = setup();

    await controller.createAppointment(bookingInput({ email: "   " }));

    expect(visits.create).toHaveBeenCalledWith(expect.objectContaining({ email: "" }));
    expect(notifications.sendMagicLink).not.toHaveBeenCalled();
  });

  it("still emails the link when an address is given", async () => {
    const { controller, notifications } = setup();

    await controller.createAppointment(bookingInput({ email: " nino@example.com " }));

    expect(notifications.sendMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nino@example.com", manageUrl: "https://acme.platform.ge/manage/issued" }),
    );
  });
});

describe("creating a visit", () => {
  it("passes the per-service professional choices through untouched (R200)", async () => {
    const { controller, visits } = setup();

    await controller.createAppointment(bookingInput({ serviceIds: ["s1", "s2"], professionalIds: ["p1", "p2"] }));

    expect(visits.create).toHaveBeenCalledWith(
      expect.objectContaining({ serviceIds: ["s1", "s2"], professionalIds: ["p1", "p2"] }),
    );
  });

  it("answers with the visit, not a bare appointment id", async () => {
    const { controller } = setup();

    const result = await controller.createAppointment(bookingInput());

    expect(result.visit).toMatchObject({ id: "v1", segments: [expect.objectContaining({ professionalName: "Nina" })] });
  });
});

// R250
describe("holds", () => {
  const req = { ip: "10.0.0.5" } as FastifyRequest;
  const holdInput = (overrides: Record<string, unknown> = {}) => ({
    serviceIds: ["s1"],
    professionalIds: ["any"],
    locationId: "loc-a",
    date: "2026-08-05",
    time: "11:00",
    ...overrides,
  });

  it("answers with the hold's id, expiry and the plan actually held", async () => {
    const { controller } = setup();

    await expect(controller.holdSlot(holdInput(), undefined, req)).resolves.toEqual({
      holdId: HOLD,
      expiresAt: FUTURE.toISOString(),
      slot: { startAt: "x", endAt: "y", segments: [] },
    });
  });

  it("passes a previous hold on to be replaced, and drops one that isn't a hold id", async () => {
    const { controller, visits } = setup();

    await controller.holdSlot(holdInput({ replaceHoldId: HOLD }), undefined, req);
    await controller.holdSlot(holdInput({ replaceHoldId: "'; drop table" }), undefined, req);

    expect(visits.hold.mock.calls.map(([input]) => input.replaceHoldId)).toEqual([HOLD, null]);
  });

  it("lets the 409 through when the time is gone, so the site can refresh the times", async () => {
    const { controller, visits } = setup();
    visits.hold.mockRejectedValue(new ConflictException({ code: "booking_conflict", conflicts: [] }));

    await expect(controller.holdSlot(holdInput(), undefined, req)).rejects.toThrow(ConflictException);
  });

  it("answers 429 past the per-visitor limit, without planning anything", async () => {
    const { controller, visits } = setup({ counters: [21] });

    const error = await controller.holdSlot(holdInput(), undefined, req).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(visits.hold).not.toHaveBeenCalled();
  });

  it("answers 429 when the tenant's live-hold cap is hit", async () => {
    const { controller, visits } = setup();
    visits.hold.mockRejectedValue(new HoldLimitError("cap"));

    const error = await controller.holdSlot(holdInput(), undefined, req).catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(429);
  });

  it("counts per visitor, by the address the public site forwards", async () => {
    const { controller, redis } = setup();

    await controller.holdSlot(holdInput(), "203.0.113.7, 10.0.0.1", req);
    await controller.holdSlot(holdInput(), "198.51.100.2", req);

    const keys = (redis.client.incr as jest.Mock).mock.calls.map(([key]) => key as string);
    expect(keys[0]).toMatch(new RegExp(`^hold:${TENANT_ID}:`));
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys.join()).not.toContain("203.0.113.7");
  });

  it("still holds when Redis is down — the limit fails open", async () => {
    const { controller, redis, visits } = setup();
    (redis.client.incr as jest.Mock).mockRejectedValue(new Error("down"));

    await controller.holdSlot(holdInput(), undefined, req);

    expect(visits.hold).toHaveBeenCalled();
  });

  it("releases a hold, and quietly ignores anything that isn't a hold id", async () => {
    const { controller, visits } = setup();

    await controller.releaseHold(HOLD);
    await controller.releaseHold("not-a-uuid");

    expect(visits.release.mock.calls).toEqual([[HOLD]]);
  });

  it("books against the customer's hold, ignoring a malformed one", async () => {
    const { controller, visits } = setup();

    await controller.createAppointment(bookingInput({ holdId: HOLD }));
    await controller.createAppointment(bookingInput({ holdId: "nope" }));

    expect(visits.create.mock.calls.map(([input]) => input.holdId)).toEqual([HOLD, null]);
  });

  it("keeps the asker's own hold out of their availability", async () => {
    const { controller, availability } = setup();

    await controller.getAvailability({ serviceIds: ["s1"], date: "2026-08-05", holdId: HOLD });

    expect(availability.computeVisitSlots).toHaveBeenCalledWith(expect.objectContaining({ holdId: HOLD }));
  });

  it("reads the first hop of x-forwarded-for, falling back to the socket", () => {
    expect(visitorIp("203.0.113.7, 10.0.0.1", "10.0.0.5")).toBe("203.0.113.7");
    expect(visitorIp(undefined, "10.0.0.5")).toBe("10.0.0.5");
    expect(visitorIp("  ", "10.0.0.5")).toBe("10.0.0.5");
  });
});

describe("phone verification gate", () => {
  it("consumes the token for the number being booked, before writing anything", async () => {
    const { controller, verification, visits } = setup();

    await controller.createAppointment(bookingInput());

    expect(verification.consume).toHaveBeenCalledWith("+995555123456", "verification-token");
    // noUncheckedIndexedAccess: both calls are asserted above, so these exist.
    const [consumedAt] = verification.consume.mock.invocationCallOrder;
    const [createdAt] = visits.create.mock.invocationCallOrder;
    expect(consumedAt).toBeDefined();
    expect(createdAt).toBeDefined();
    expect(consumedAt as number).toBeLessThan(createdAt as number);
  });

  it("never creates the visit when the token is refused", async () => {
    const { controller, verification, visits } = setup();
    verification.consume.mockRejectedValue(new BadRequestException("nope"));

    await expect(controller.createAppointment(bookingInput())).rejects.toThrow(BadRequestException);
    expect(visits.create).not.toHaveBeenCalled();
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
