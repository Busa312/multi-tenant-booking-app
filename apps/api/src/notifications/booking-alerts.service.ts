import { Injectable, Logger } from "@nestjs/common";
import type { PushLocale } from "@booking/shared-types";
import type { PrismaVisit } from "../common/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { PushService } from "./push.service.js";
import { bookingAlertPayload, toPushLocale, type BookingAlert, type BookingAlertKind } from "./push-templates.js";

const asTranslations = (value: unknown): Record<string, string> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : null;

/**
 * R620: tells the salon's staff, by push, that a customer booked, cancelled or
 * moved a visit online. Who: the owner, plus every login whose professional
 * has a segment of the visit — active logins only, on devices switched on
 * since the user's sessions were last ended (R320).
 *
 * Best effort and off the customer's path: `notifyInBackground` returns at
 * once, and nothing here ever throws.
 */
@Injectable()
export class BookingAlertsService {
  private readonly logger = new Logger(BookingAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly push: PushService,
  ) {}

  /** Called once the customer's change has committed; never awaited by their request. */
  notifyInBackground(kind: BookingAlertKind, visit: PrismaVisit): void {
    void this.notify(kind, visit);
  }

  async notify(kind: BookingAlertKind, visit: PrismaVisit): Promise<void> {
    if (!this.push.publicKey) return;
    const tenantId = this.tenantContext.currentOrNull?.tenantId;
    if (!tenantId) return;

    try {
      // A cancellation describes what was booked; anything else, what still stands.
      const live = visit.appointments.filter((appointment) => appointment.status !== "cancelled");
      const segments = kind === "cancelled" || live.length === 0 ? visit.appointments : live;
      const first = segments[0];
      if (!first) return;
      const professionalIds = [
        ...new Set(segments.map((segment) => segment.professionalId).filter((id): id is string => id !== null)),
      ];

      const { timezone, users, subscriptions } = await this.prisma.forTenant(async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { timezone: true } });
        const recipients = await tx.tenantUser.findMany({
          where: {
            tenantId,
            isActive: true,
            OR: [{ role: "owner" }, ...(professionalIds.length > 0 ? [{ professionalId: { in: professionalIds } }] : [])],
          },
          select: { id: true, sessionVersion: true },
        });
        const devices =
          recipients.length === 0
            ? []
            : await tx.pushSubscription.findMany({
                where: { tenantId, tenantUserId: { in: recipients.map((user) => user.id) } },
                select: { id: true, tenantUserId: true, endpoint: true, p256dh: true, auth: true, locale: true, sessionVersion: true },
              });
        return { timezone: tenant.timezone, users: recipients, subscriptions: devices };
      });
      if (subscriptions.length === 0) return;

      // R320: a device switched on before the user's sessions were ended stays silent.
      const sessionVersions = new Map(users.map((user) => [user.id, user.sessionVersion]));
      const stale = subscriptions.filter((sub) => sessionVersions.get(sub.tenantUserId) !== sub.sessionVersion);
      const current = subscriptions.filter((sub) => sessionVersions.get(sub.tenantUserId) === sub.sessionVersion);

      const firstLine = first.services[0];
      const alert: BookingAlert = {
        kind,
        visitId: visit.id,
        customerName: first.userName,
        serviceName: firstLine?.service.name ?? "",
        serviceNameI18n: asTranslations(firstLine?.service.nameI18n),
        moreServices: Math.max(0, segments.reduce((count, segment) => count + segment.services.length, 0) - 1),
        startAt: first.startAt,
        timezone,
        // R630
        homeVisit: first.place === "customer",
      };
      const payloads = new Map<PushLocale, ReturnType<typeof bookingAlertPayload>>();
      const payloadFor = (locale: PushLocale) => {
        const known = payloads.get(locale);
        if (known) return known;
        const made = bookingAlertPayload(alert, locale);
        payloads.set(locale, made);
        return made;
      };

      const outcomes = await Promise.all(
        current.map(async (sub) => ({ id: sub.id, outcome: await this.push.send(sub, payloadFor(toPushLocale(sub.locale))) })),
      );
      const forget = [...stale.map((sub) => sub.id), ...outcomes.filter((o) => o.outcome === "gone").map((o) => o.id)];
      const delivered = outcomes.filter((o) => o.outcome === "sent").map((o) => o.id);

      if (forget.length > 0 || delivered.length > 0) {
        await this.prisma.forTenant(async (tx) => {
          if (forget.length > 0) await tx.pushSubscription.deleteMany({ where: { tenantId, id: { in: forget } } });
          if (delivered.length > 0) {
            await tx.pushSubscription.updateMany({ where: { tenantId, id: { in: delivered } }, data: { lastSuccessAt: new Date() } });
          }
        });
      }
    } catch (error) {
      this.logger.error(`couldn't send the ${kind} alert for visit ${visit.id}: ${(error as Error).message}`);
    }
  }
}
