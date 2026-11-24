import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";
import type { PrismaVisit } from "../common/serializers.js";
import { BookingAlertsService } from "./booking-alerts.service.js";
import type { PushOutcome, PushService } from "./push.service.js";

// R620: who hears about a customer's booking, cancellation or reschedule

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const START = new Date("2026-11-24T07:45:00.000Z");

const segment = (overrides: Record<string, unknown> = {}) => ({
  id: "a1",
  professionalId: "pro-1",
  status: "booked",
  userName: "Nino Beridze",
  phoneNumber: "+995555123456",
  startAt: START,
  services: [{ service: { name: "Haircut", nameI18n: { ka: "თმის შეჭრა" } } }],
  ...overrides,
});

const visit = (appointments: Record<string, unknown>[] = [segment()]) => ({ id: "v1", appointments }) as unknown as PrismaVisit;

const device = (overrides: Record<string, unknown> = {}) => ({
  id: "d-owner",
  tenantUserId: "u-owner",
  endpoint: "https://fcm.googleapis.com/fcm/send/owner",
  p256dh: "key",
  auth: "secret",
  locale: "en",
  sessionVersion: 0,
  ...overrides,
});

interface Setup {
  configured?: boolean;
  users?: { id: string; sessionVersion: number }[];
  devices?: ReturnType<typeof device>[];
  outcomes?: Record<string, PushOutcome>;
  tenantId?: string | null;
}

const setup = ({
  configured = true,
  users = [{ id: "u-owner", sessionVersion: 0 }],
  devices = [device()],
  outcomes = {},
  tenantId = TENANT_ID,
}: Setup = {}) => {
  const tx = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: "Asia/Tbilisi" }) },
    tenantUser: { findMany: jest.fn().mockResolvedValue(users) },
    pushSubscription: {
      findMany: jest.fn().mockResolvedValue(devices),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = { forTenant: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) } as unknown as PrismaService;
  const tenantContext = { currentOrNull: tenantId ? { tenantId } : null } as unknown as TenantContextService;
  const push = {
    publicKey: configured ? "public" : null,
    send: jest.fn((target: { endpoint: string }) => Promise.resolve(outcomes[target.endpoint] ?? "sent")),
  };
  const service = new BookingAlertsService(prisma, tenantContext, push as unknown as PushService);
  return { service, tx, push, prisma };
};

describe("BookingAlertsService", () => {
  it("asks for the owner and the visit's professionals, active logins only", async () => {
    const { service, tx } = setup();
    await service.notify("booked", visit([segment(), segment({ id: "a2", professionalId: "pro-2" }), segment({ id: "a3" })]));

    expect(tx.tenantUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT_ID,
          isActive: true,
          OR: [{ role: "owner" }, { professionalId: { in: ["pro-1", "pro-2"] } }],
        },
      }),
    );
    expect(tx.pushSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID, tenantUserId: { in: ["u-owner"] } } }),
    );
  });

  it("leaves out professionals whose segment staff already cancelled, unless the whole visit is the news", async () => {
    const segments = [segment(), segment({ id: "a2", professionalId: "pro-2", status: "cancelled" })];
    const booked = setup();
    await booked.service.notify("rescheduled", visit(segments));
    expect(booked.tx.tenantUser.findMany.mock.calls[0]?.[0]?.where.OR).toEqual([
      { role: "owner" },
      { professionalId: { in: ["pro-1"] } },
    ]);

    const cancelled = setup();
    await cancelled.service.notify("cancelled", visit(segments.map((s) => ({ ...s, status: "cancelled" }))));
    expect(cancelled.tx.tenantUser.findMany.mock.calls[0]?.[0]?.where.OR).toEqual([
      { role: "owner" },
      { professionalId: { in: ["pro-1", "pro-2"] } },
    ]);
  });

  it("sends every device its own language, never the phone number", async () => {
    const { service, push } = setup({
      users: [
        { id: "u-owner", sessionVersion: 0 },
        { id: "u-pro", sessionVersion: 3 },
      ],
      devices: [
        device(),
        device({ id: "d-pro", tenantUserId: "u-pro", endpoint: "https://web.push.apple.com/pro", locale: "ka", sessionVersion: 3 }),
      ],
    });
    await service.notify("booked", visit());

    expect(push.send).toHaveBeenCalledTimes(2);
    const [toOwner, toPro] = push.send.mock.calls.map((call) => (call as unknown[])[1] as { title: string; body: string });
    expect(toOwner).toMatchObject({ title: "New booking", body: "Nino · Haircut · Tue, Nov 24 11:45" });
    expect(toPro).toMatchObject({ title: "ახალი ჯავშანი", body: "Nino · თმის შეჭრა · სამ, 24 ნოე 11:45" });
    expect(JSON.stringify(push.send.mock.calls)).not.toContain("555123456");
  });

  // R320
  it("stays silent on a device switched on before the user's sessions were ended, and forgets it", async () => {
    const { service, push, tx } = setup({ users: [{ id: "u-owner", sessionVersion: 1 }], devices: [device({ sessionVersion: 0 })] });
    await service.notify("booked", visit());

    expect(push.send).not.toHaveBeenCalled();
    expect(tx.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, id: { in: ["d-owner"] } } });
  });

  it("forgets devices the push service reports gone and stamps the ones it accepted", async () => {
    const { service, tx } = setup({
      devices: [device(), device({ id: "d-old", endpoint: "https://fcm.googleapis.com/fcm/send/old" })],
      outcomes: { "https://fcm.googleapis.com/fcm/send/old": "gone" },
    });
    await service.notify("booked", visit());

    expect(tx.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, id: { in: ["d-old"] } } });
    expect(tx.pushSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID, id: { in: ["d-owner"] } } }),
    );
  });

  it("keeps a device whose push merely failed", async () => {
    const { service, tx } = setup({ outcomes: { [device().endpoint]: "failed" } });
    await service.notify("booked", visit());
    expect(tx.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it("does no work at all while push isn't configured", async () => {
    const { service, prisma } = setup({ configured: false });
    await service.notify("booked", visit());
    expect(prisma.forTenant).not.toHaveBeenCalled();
  });

  it("never throws, so it can't fail the customer's booking", async () => {
    const { service, tx } = setup();
    tx.tenantUser.findMany.mockRejectedValueOnce(new Error("database down"));
    await expect(service.notify("booked", visit())).resolves.toBeUndefined();
  });
});
