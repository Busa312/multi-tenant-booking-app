import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { BillingService } from "./billing.service.js";
import { FlittClient } from "./flitt.client.js";

const DAY = 24 * 60 * 60_000;

/**
 * R470: charges renewals that are due, every few minutes, inside the API
 * process (system_design.md §12b). Safe with several instances running:
 * `BillingService.renewIfDue` leases a subscription before charging it. Idle
 * when Flitt isn't configured; `BILLING_SCHEDULER=off` turns it off outright.
 */
@Injectable()
export class BillingScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BillingScheduler.name);
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly billing: BillingService,
    private readonly flitt: FlittClient,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.flitt.configured || process.env.BILLING_SCHEDULER === "off" || process.env.NODE_ENV === "test") return;
    const { cycle } = this.flitt.config;
    // A test environment running months in minutes is checked every minute.
    const every = cycle.kind === "fixed" && cycle.ms < DAY ? 60_000 : 5 * 60_000;
    this.timers = [setInterval(() => void this.tick(), every), setTimeout(() => void this.tick(), 15_000)];
    for (const timer of this.timers) timer.unref();
    this.logger.log(`renewals checked every ${every / 60_000} min`);
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearTimeout(timer);
  }

  /** One pass over every tenant. The `tenant` table has no RLS; each tenant's own data is read in its own context. */
  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.prisma.client.tenant.findMany({ select: { id: true } });
      for (const { id } of tenants) {
        try {
          await this.tenantContext.runWithTenant(id, () => this.billing.renewIfDue(now));
        } catch (error) {
          this.logger.error(`renewal check for tenant ${id} failed: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      this.logger.error(`renewal pass failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
