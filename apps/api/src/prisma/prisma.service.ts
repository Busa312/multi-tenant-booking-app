import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient, Prisma } from "../../generated/prisma/index.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";

/**
 * Thin wrapper around PrismaClient. Deliberately does NOT expose the raw
 * client's model delegates (`this.tenant`, `this.appointment`, ...) for
 * general use — every tenant-scoped query must go through `forTenant`, which
 * sets the `app.tenant_id` session variable Postgres RLS policies key off
 * (system_design.md §4) inside the same transaction as the query. `client`
 * is exposed for the narrow set of callers that are themselves resolving
 * tenant identity (e.g. TenantResolverService) and therefore run before a
 * tenant context exists.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(private readonly tenantContext: TenantContextService) {
    // Deliberately NOT `DATABASE_URL` (that's the migration/owner connection —
    // table owners bypass RLS in Postgres regardless of policies). The
    // running API connects as a separate, non-owner, non-superuser role so
    // RLS policies actually apply to it. See prisma/migrations/*_rls and
    // docker/postgres/init.sql for where that role is created and granted.
    this.client = new PrismaClient({ datasourceUrl: process.env.APP_DATABASE_URL });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  /**
   * Runs `fn` inside a transaction with `app.tenant_id` set from the current
   * request's TenantContextService, so every RLS policy on every table
   * scopes automatically. `set_config` (not string-interpolated `SET LOCAL`)
   * is used so the tenant id is passed as a bound parameter, not concatenated
   * into SQL.
   */
  async forTenant<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const { tenantId } = this.tenantContext.current;
    return this.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }
}
