import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";
import type { NotificationService } from "../notifications/notification.service.js";
import type { BookingService } from "./booking.service.js";
import { hashToken } from "./magic-link.js";
import { ReminderService } from "./reminder.service.js";

// R610: one reminder per visit, never twice, never at a blocked number

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-11-25T11:00:00Z"); // 15:00 in Tbilisi
const START = new Date("2026-11-26T11:00:00Z"); // tomorrow 15:00: a 24 h reminder is due now
const BOOKED = new Date("2026-11-20T10:00:00Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "a1",
  visitId: "v1",
  startAt: START,
  endAt: new Date(START.getTime() + 60 * 60_000),
  createdAt: BOOKED,
  phoneNumber: "+995 555 12 34 56",
  phoneKey: "995555123456",
  ...overrides,
});

interface Setup {
  rows?: ReturnType<typeof row>[];
  hoursBefore?: number;
  blocked?: string[];
  claimed?: number;
  delivered?: boolean;
  canSend?: boolean;
  rotated?: string | null;
}

const setup = ({
  rows = [row()],
  hoursBefore = 24,
  blocked = [],
  claimed = 1,
  delivered = true,
  canSend = true,
  rotated = "fresh-token",
}: Setup = {}) => {
  const tx = {
    tenant: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        timezone: "Asia/Tbilisi",
        reminderHoursBefore: hoursBefore,
        subdomain: "aura",
        customDomain: null,
        domainVerifiedAt: null,
      }),
    },
    appointment: {
      findMany: jest.fn().mockResolvedValue(rows),
      // The claim answers `claimed`; a release answers whatever it touched
      updateMany: jest.fn(({ data }: { data: { reminderSentAt: Date | null } }) =>
        Promise.resolve({ count: data.reminderSentAt ? claimed : 1 }),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    blockedPhone: { findMany: jest.fn().mockResolvedValue(blocked.map((phoneKey) => ({ phoneKey }))) },
    visit: { create: jest.fn().mockResolvedValue({ id: "v-staff" }) },
  };
  const prisma = { forTenant: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT_ID } } as unknown as TenantContextService;
  const booking = { rotateVisitToken: jest.fn().mockResolvedValue(rotated) };
  const notifications = {
    canSendReminders: jest.fn().mockReturnValue(canSend),
    sendReminder: jest.fn().mockResolvedValue(delivered),
  };
  const config = {
    get: (key: string) => ({ PUBLIC_SITE_URL: "https://public.internal", PUBLIC_SITE_BASE_DOMAIN: "book-it.ge" })[key],
  } as unknown as ConfigService;
  const service = new ReminderService(
    prisma,
    tenantContext,
    booking as unknown as BookingService,
    notifications as unknown as NotificationService,
    config,
  );
  return { service, tx, booking, notifications };
};

const claimCalls = (tx: ReturnType<typeof setup>["tx"]) =>
  tx.appointment.updateMany.mock.calls.filter(([args]) => (args as { data: { reminderSentAt: Date | null } }).data.reminderSentAt);
const releaseCalls = (tx: ReturnType<typeof setup>["tx"]) =>
  tx.appointment.updateMany.mock.calls.filter(([args]) => !(args as { data: { reminderSentAt: Date | null } }).data.reminderSentAt);

describe("ReminderService", () => {
  it("texts a due visit once, with a fresh short link, in the salon's time zone", async () => {
    const { service, notifications, booking } = setup();

    await expect(service.sendDue(NOW)).resolves.toBe(1);

    expect(booking.rotateVisitToken).toHaveBeenCalledWith(expect.anything(), TENANT_ID, "v1");
    expect(notifications.sendReminder).toHaveBeenCalledWith(
      "+995 555 12 34 56",
      "Reminder: Thu 26 Nov 15:00. Confirm or cancel: https://aura.book-it.ge/m/fresh-token",
    );
  });

  it("asks only for booked, not-yet-reminded bookings starting soon", async () => {
    const { service, tx } = setup();
    await service.sendDue(NOW);
    expect(tx.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT_ID,
          status: "booked",
          reminderSentAt: null,
          startAt: { gt: NOW, lte: new Date(NOW.getTime() + (24 + 14) * 3_600_000) },
        },
      }),
    );
  });

  it("sends one text for a visit of several segments, timed by the first, and claims them all", async () => {
    const { service, tx, notifications } = setup({
      rows: [row(), row({ id: "a2", startAt: new Date(START.getTime() + 60 * 60_000) })],
    });

    await service.sendDue(NOW);

    expect(notifications.sendReminder).toHaveBeenCalledTimes(1);
    expect(notifications.sendReminder.mock.calls[0]?.[1]).toContain("Thu 26 Nov 15:00");
    expect(claimCalls(tx)[0]?.[0]).toMatchObject({
      where: { tenantId: TENANT_ID, id: { in: ["a1", "a2"] }, status: "booked", reminderSentAt: null },
      data: { reminderSentAt: NOW },
    });
  });

  it("sends nothing when another instance already claimed it", async () => {
    const { service, notifications, booking } = setup({ claimed: 0 });
    await expect(service.sendDue(NOW)).resolves.toBe(0);
    expect(booking.rotateVisitToken).not.toHaveBeenCalled();
    expect(notifications.sendReminder).not.toHaveBeenCalled();
  });

  it("releases the claim when the text doesn't go out, so the next pass retries", async () => {
    const { service, tx } = setup({ delivered: false });
    await expect(service.sendDue(NOW)).resolves.toBe(0);
    expect(releaseCalls(tx)[0]?.[0]).toEqual({
      where: { tenantId: TENANT_ID, id: { in: ["a1"] }, reminderSentAt: NOW },
      data: { reminderSentAt: null },
    });
  });

  // R380
  it("never texts a number this salon blocked", async () => {
    const { service, notifications, tx } = setup({ blocked: ["995555123456"] });
    await service.sendDue(NOW);
    expect(notifications.sendReminder).not.toHaveBeenCalled();
    expect(claimCalls(tx)).toHaveLength(0);
  });

  it("gives a staff booking a visit and a link of its own", async () => {
    const { service, tx, notifications } = setup({ rows: [row({ visitId: null })] });

    await service.sendDue(NOW);

    const created = tx.visit.create.mock.calls[0]?.[0] as { data: { accessTokenHash: string } };
    expect(created.data).toMatchObject({ tenantId: TENANT_ID });
    expect(tx.appointment.update).toHaveBeenCalledWith({ where: { id: "a1", tenantId: TENANT_ID }, data: { visitId: "v-staff" } });
    // The text carries the token whose hash was stored
    const token = (notifications.sendReminder.mock.calls[0]?.[1] as string).split("/m/")[1] ?? "";
    expect(hashToken(token)).toBe(created.data.accessTokenHash);
  });

  it("keeps a visit whose link was cleared linkless, and sends nothing", async () => {
    const { service, notifications } = setup({ rotated: null });
    await expect(service.sendDue(NOW)).resolves.toBe(0);
    expect(notifications.sendReminder).not.toHaveBeenCalled();
  });

  it.each([
    ["not due yet", { rows: [row({ startAt: new Date("2026-11-27T11:00:00Z") })] }],
    ["booked after its reminder time", { rows: [row({ createdAt: NOW })] }],
    ["reminders are off", { hoursBefore: 0 }],
    ["no way to deliver them here", { canSend: false }],
  ])("does nothing when %s", async (_label, options) => {
    const { service, notifications, tx } = setup(options);
    await expect(service.sendDue(NOW)).resolves.toBe(0);
    expect(notifications.sendReminder).not.toHaveBeenCalled();
    expect(claimCalls(tx)).toHaveLength(0);
  });
});
