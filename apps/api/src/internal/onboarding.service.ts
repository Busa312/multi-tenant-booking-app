import { ConflictException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Prisma } from "../../generated/prisma/index.js";
import type { OnboardTenantRequest, OnboardTenantResponse } from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Formalizes system_design.md §9 step 2: create the Tenant row + initial
 * owner TenantUser in one transaction, assigning a subdomain. Runs outside
 * PrismaService.forTenant on purpose — no tenant_id exists yet for
 * TenantContextService to hold, since this call is what creates the tenant.
 * `Tenant` itself carries no RLS (see prisma/migrations/*_enable_rls), so it's
 * inserted directly; `tenant_user` does have RLS, so app.tenant_id is set
 * inside the same transaction right after the tenant row is created.
 */
@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async onboardTenant(input: OnboardTenantRequest): Promise<OnboardTenantResponse> {
    const passwordHash = await bcrypt.hash(input.ownerPassword, 10);

    try {
      return await this.prisma.client.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: input.name, timezone: input.timezone, subdomain: input.subdomain },
        });

        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;

        const owner = await tx.tenantUser.create({
          data: { tenantId: tenant.id, email: input.ownerEmail, passwordHash, role: "owner" },
        });

        return {
          tenantId: tenant.id,
          subdomain: tenant.subdomain,
          ownerUserId: owner.id,
          ownerEmail: owner.email,
        };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Subdomain "${input.subdomain}" is already taken`);
      }
      throw err;
    }
  }
}
