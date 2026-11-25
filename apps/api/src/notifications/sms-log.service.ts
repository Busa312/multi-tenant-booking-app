import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";

// R610: reminders are counted as their own kind
export type SmsKind = "otp" | "manage_link" | "reminder";

/**
 * R500: one row per text the provider accepted, in the sending salon's
 * context — the usage count. Nothing about the text itself is kept.
 */
@Injectable()
export class SmsLogService {
  private readonly logger = new Logger(SmsLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Best effort: a text that went out is never turned into a failure by its bookkeeping. */
  async record(kind: SmsKind, parts: number): Promise<void> {
    const tenantId = this.tenantContext.currentOrNull?.tenantId;
    if (!tenantId) {
      this.logger.warn(`a ${kind} text was sent outside any salon's context; not counted`);
      return;
    }
    try {
      await this.prisma.forTenant((tx) => tx.smsMessage.create({ data: { tenantId, kind, parts } }));
    } catch (error) {
      this.logger.error(`couldn't count a ${kind} text: ${(error as Error).message}`);
    }
  }
}
