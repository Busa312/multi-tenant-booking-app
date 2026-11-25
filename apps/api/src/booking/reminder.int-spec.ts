import type { ConfigService } from "@nestjs/config";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import type { NotificationService } from "../notifications/notification.service.js";
import { zonedTimeToUtc } from "../common/timezone.js";
import type { AvailabilityService } from "./availability.service.js";
import { BookingService } from "./booking.service.js";
import { ReminderService } from "./reminder.service.js";
import { asTenant, createTenant, dropTenant, ownerClient, tbilisiDate, type TenantFixture } from "../testing/integration-fixtures.js";

/**
 * R610 against the real database, as the app's role: two reminder passes
 * racing for the same booking text it once, and a pass for another salon
 * never sees, claims or texts this salon's bookings (RLS).
 */
describe("Reminders (integration)", () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let context: TenantContextService;
  let salon: TenantFixture;
  let other: TenantFixture;
  let appointmentId: string;
  const sendReminder = jest.fn().mockResolvedValue(true);

  // A day pass in Tbilisi: 12:00 two days from now, with a staff booking at
  // 08:00 the next morning — its 24 h reminder fell at night, so it was pulled
  // to 20:00 the evening before last, and is due.
  const now = zonedTimeToUtc(tbilisiDate(2), 12 * 60, "Asia/Tbilisi");
  const startAt = new Date(now.getTime() + 20 * 3_600_000);

  const reminders = () =>
    new ReminderService(
      prisma,
      context,
      new BookingService(prisma, context, {} as AvailabilityService),
      { canSendReminders: () => true, sendReminder } as unknown as NotificationService,
      { get: (key: string) => (key === "PUBLIC_SITE_BASE_DOMAIN" ? "book-it.test" : undefined) } as unknown as ConfigService,
    );

  beforeAll(async () => {
    owner = ownerClient();
    context = new TenantContextService();
    prisma = new PrismaService(context);
    await prisma.onModuleInit();
    salon = await createTenant(owner, "remind");
    other = await createTenant(owner, "remind-other");
    const appointment = await owner.appointment.create({
      data: {
        tenantId: salon.tenantId,
        professionalId: salon.professionalId,
        userName: "Nino",
        phoneNumber: "+995555000610",
        phoneKey: "995555000610",
        email: "",
        startAt,
        endAt: new Date(startAt.getTime() + 60 * 60_000),
        price: "40.00",
      },
    });
    appointmentId = appointment.id;
  });

  afterAll(async () => {
    await dropTenant(owner, salon.tenantId);
    await dropTenant(owner, other.tenantId);
    await prisma.onModuleDestroy();
    await owner.$disconnect();
  });

  it("leaves another salon's bookings alone", async () => {
    await expect(asTenant(context, other.tenantId, () => reminders().sendDue(now))).resolves.toBe(0);
    const row = await owner.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(row.reminderSentAt).toBeNull();
    expect(sendReminder).not.toHaveBeenCalled();
  });

  it("texts once when two passes race, and gives the staff booking a link", async () => {
    const results = await Promise.all([
      asTenant(context, salon.tenantId, () => reminders().sendDue(now)),
      asTenant(context, salon.tenantId, () => reminders().sendDue(now)),
    ]);

    expect(results.reduce((sum, sent) => sum + sent, 0)).toBe(1);
    expect(sendReminder).toHaveBeenCalledTimes(1);
    expect(sendReminder.mock.calls[0]?.[1]).toMatch(/^Reminder: .+ 08:00\. Confirm or cancel: https:\/\/it-remind-[a-z0-9-]+\.book-it\.test\/m\//);

    const row = await owner.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: { visit: true } });
    expect(row.reminderSentAt).toEqual(now);
    expect(row.visit?.accessTokenHash).toBeTruthy();
  });

  it("doesn't text it again on the next pass", async () => {
    await expect(asTenant(context, salon.tenantId, () => reminders().sendDue(new Date(now.getTime() + 5 * 60_000)))).resolves.toBe(0);
    // (call counts reset between tests)
    expect(sendReminder).not.toHaveBeenCalled();
  });
});
