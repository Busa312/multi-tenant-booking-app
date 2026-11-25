import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { NotificationService } from "../notifications/notification.service.js";
import { reminderText } from "../notifications/reminder-text.js";
import { shortManageUrl, tenantSiteOrigin } from "../common/tenant-url.js";
import { loadBlockedKeys } from "./blocked-phone.service.js";
import { BookingService } from "./booking.service.js";
import { issueToken } from "./magic-link.js";
import { reminderLookaheadMs, reminderVerdict } from "./reminder-schedule.js";

interface DueRow {
  id: string;
  visitId: string | null;
  startAt: Date;
  endAt: Date;
  createdAt: Date;
  phoneNumber: string;
  phoneKey: string;
}

/** One text's worth: a visit's not-yet-reminded segments, or one staff booking. */
interface ReminderGroup {
  visitId: string | null;
  rows: DueRow[];
}

/**
 * R610: one pass of reminders for the tenant in context (ReminderScheduler
 * calls it for each). Safe with several API instances: a group is claimed by
 * a conditional update before anything else happens, and only the instance
 * whose update hit the rows sends.
 */
@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly booking: BookingService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  /** Sends what is due; returns how many texts went out. */
  async sendDue(now = new Date()): Promise<number> {
    if (!this.notifications.canSendReminders()) return 0;
    const { tenantId } = this.tenantContext.current;

    const found = await this.prisma.forTenant(async (tx) => {
      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { timezone: true, reminderHoursBefore: true, subdomain: true, customDomain: true, domainVerifiedAt: true },
      });
      if (tenant.reminderHoursBefore <= 0) return null;
      const rows: DueRow[] = await tx.appointment.findMany({
        where: {
          tenantId,
          status: "booked",
          reminderSentAt: null,
          startAt: { gt: now, lte: new Date(now.getTime() + reminderLookaheadMs(tenant.reminderHoursBefore)) },
        },
        select: { id: true, visitId: true, startAt: true, endAt: true, createdAt: true, phoneNumber: true, phoneKey: true },
        orderBy: { startAt: "asc" },
      });
      // R380: a number this salon blocked gets no texts from it
      const blocked = await loadBlockedKeys(tx, tenantId, rows.map((row) => row.phoneNumber));
      return { tenant, rows: rows.filter((row) => !blocked.has(row.phoneKey)) };
    });
    if (!found || found.rows.length === 0) return 0;
    const { tenant } = found;

    const origin = tenantSiteOrigin(tenant, {
      siteUrl: this.config.get<string>("PUBLIC_SITE_URL"),
      baseDomain: this.config.get<string>("PUBLIC_SITE_BASE_DOMAIN"),
    });
    if (!origin) {
      this.logger.warn("reminders skipped: PUBLIC_SITE_BASE_DOMAIN isn't set, so no link can be built");
      return 0;
    }

    let sent = 0;
    for (const group of groupByVisit(found.rows)) {
      const first = group.rows[0];
      if (!first) continue;
      const createdAt = new Date(Math.min(...group.rows.map((row) => row.createdAt.getTime())));
      if (reminderVerdict({ startAt: first.startAt, createdAt }, tenant.reminderHoursBefore, tenant.timezone, now) !== "send") {
        continue;
      }
      if (await this.remind(tenantId, group, first, tenant.timezone, origin, now)) sent += 1;
    }
    return sent;
  }

  private async remind(
    tenantId: string,
    group: ReminderGroup,
    first: DueRow,
    timezone: string,
    origin: string,
    now: Date,
  ): Promise<boolean> {
    const ids = group.rows.map((row) => row.id);

    // The claim and the fresh link commit together, before anything is sent.
    const claim = await this.prisma.forTenant(async (tx) => {
      const claimed = await tx.appointment.updateMany({
        where: { tenantId, id: { in: ids }, status: "booked", reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (claimed.count === 0) return null;

      if (group.visitId) {
        // Links are stored only as a hash: the reminder carries a fresh one (as resend does)
        return { token: await this.booking.rotateVisitToken(tx, tenantId, group.visitId) };
      }
      // A staff booking has no visit yet: it gets one, and with it a link
      const issued = issueToken(first.endAt);
      const visit = await tx.visit.create({
        data: { tenantId, accessTokenHash: issued.accessTokenHash, accessTokenExpiresAt: issued.accessTokenExpiresAt },
        select: { id: true },
      });
      await tx.appointment.update({ where: { id: first.id, tenantId }, data: { visitId: visit.id } });
      return { token: issued.token };
    });

    // Another instance got there first.
    if (!claim) return false;
    // A visit whose link was cleared (the customer cancelled it) stays linkless; nothing to send.
    if (!claim.token) return false;

    const text = reminderText(first.startAt, timezone, shortManageUrl(origin, claim.token));
    if (await this.notifications.sendReminder(first.phoneNumber, text)) return true;

    // Not sent: release the claim, so the next pass tries again (until the start).
    await this.prisma.forTenant((tx) =>
      tx.appointment.updateMany({ where: { tenantId, id: { in: ids }, reminderSentAt: now }, data: { reminderSentAt: null } }),
    );
    return false;
  }
}

/** R610: one text per visit, timed by its earliest segment; a staff booking is its own group. Rows come sorted by start. */
export function groupByVisit(rows: DueRow[]): ReminderGroup[] {
  const groups = new Map<string, ReminderGroup>();
  for (const row of rows) {
    const key = row.visitId ?? `appointment:${row.id}`;
    const group = groups.get(key);
    if (group) group.rows.push(row);
    else groups.set(key, { visitId: row.visitId, rows: [row] });
  }
  return [...groups.values()];
}
