import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Prisma } from "../../generated/prisma/index.js";
import type { OnboardTenantRequest, OnboardTenantResponse } from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { isValidTimezone } from "../common/timezone.js";

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async onboardTenant(input: OnboardTenantRequest): Promise<OnboardTenantResponse> {
    if (!isValidTimezone(input.timezone)) {
      throw new BadRequestException(
        `timezone must be a valid IANA zone, e.g. "Asia/Tbilisi" — received "${input.timezone}"`,
      );
    }

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
