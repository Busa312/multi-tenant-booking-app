import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { ReminderService } from "./reminder.service.js";

const EVERY_MS = 5 * 60_000;

/**
 * R610: sends due reminders every few minutes, inside the API process — the
 * BillingScheduler pattern (system_design.md §6). Safe with several instances:
 * ReminderService claims before it sends. `REMINDER_SCHEDULER=off` turns it
 * off; it never runs in tests.
 */
@Injectable()
export class ReminderScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ReminderScheduler.name);
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly reminders: ReminderService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.REMINDER_SCHEDULER === "off" || process.env.NODE_ENV === "test") return;
    this.timers = [setInterval(() => void this.tick(), EVERY_MS), setTimeout(() => void this.tick(), 20_000)];
    for (const timer of this.timers) timer.unref();
    this.logger.log(`reminders checked every ${EVERY_MS / 60_000} min`);
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearTimeout(timer);
  }

  /** One pass over the tenants with reminders on. The `tenant` table has no RLS; each tenant's data is read in its own context. */
  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.prisma.client.tenant.findMany({ where: { reminderHoursBefore: { gt: 0 } }, select: { id: true } });
      for (const { id } of tenants) {
        try {
          await this.tenantContext.runWithTenant(id, () => this.reminders.sendDue(now));
        } catch (error) {
          this.logger.error(`reminders for tenant ${id} failed: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      this.logger.error(`reminder pass failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
