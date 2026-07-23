import { BadRequestException, Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Tenant, TenantColors, TenantConfig } from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { serializeTenant } from "../common/serializers.js";
import { TenantDto, UpdateTenantColorsRequestDto, UpdateTenantConfigRequestDto } from "../common/dto.js";
import { RevalidationService } from "./revalidation.service.js";
import { isValidColor } from "./color-validation.js";

@ApiTags("cms-tenant")
@ApiBearerAuth()
@Controller("cms/tenant")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Get()
  @ApiOkResponse({ type: TenantDto })
  async getTenant(): Promise<Tenant> {
    const { tenantId } = this.tenantContext.current;
    const tenant = await this.prisma.forTenant((tx) => tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }));
    return serializeTenant(tenant);
  }

  @Patch("config")
  @Roles("owner")
  @ApiBody({ type: UpdateTenantConfigRequestDto })
  @ApiOkResponse({ type: TenantDto })
  async updateConfig(@Body("configJson") configJson: unknown): Promise<Tenant> {
    if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
      throw new BadRequestException("configJson must be an object");
    }
    const next = configJson as TenantConfig;
    if (next.colors !== undefined) {
      this.validateColors(next.colors);
    }

    const { tenantId } = this.tenantContext.current;
    // Merges rather than replacing the whole column: a caller updating
    // logoUrl/copy (this endpoint's actual purpose — colors have their own
    // dedicated endpoint below) must not silently wipe colors just because
    // it didn't mention them.
    return this.mutateConfig(tenantId, (current) => ({ ...current, ...next }));
  }

  // Dedicated colors endpoint (rather than folding into PATCH /config) so
  // validation, merge-not-replace semantics, and the revalidation trigger
  // stay isolated from the generic config endpoint above.
  @Patch("colors")
  @Roles("owner")
  @ApiBody({ type: UpdateTenantColorsRequestDto })
  @ApiOkResponse({ type: TenantDto })
  async updateColors(@Body("colors") colors: unknown): Promise<Tenant> {
    this.validateColors(colors);
    const { tenantId } = this.tenantContext.current;

    return this.mutateConfig(tenantId, (current) => ({
      ...current,
      colors: { ...current.colors, ...(colors as TenantColors) },
    }));
  }

  // Reverts to the platform default palette by removing the `colors` key
  // entirely, rather than writing today's default hex values into the row —
  // so a future change to the platform default takes effect for reset
  // tenants automatically (fallback is resolved at read time everywhere).
  @Post("colors/reset")
  @Roles("owner")
  @ApiOkResponse({ type: TenantDto })
  async resetColors(): Promise<Tenant> {
    const { tenantId } = this.tenantContext.current;

    return this.mutateConfig(tenantId, (current) => {
      const { colors: _colors, ...rest } = current;
      return rest;
    });
  }

  /**
   * Shared read-lock-modify-write for every configJson mutation. `SELECT ...
   * FOR UPDATE` locks the row for the rest of the transaction so a second,
   * concurrent mutation (e.g. two browser tabs saving colors at once) blocks
   * until the first commits, then reads its result — without this, both
   * transactions read the same pre-update snapshot at Postgres's default
   * READ COMMITTED isolation and whichever commits last silently overwrites
   * the other's change. Readers (plain SELECTs, e.g. GET /cms/tenant) are
   * never blocked by this lock — only concurrent locking writers serialize.
   */
  private async mutateConfig(tenantId: string, mutate: (current: TenantConfig) => TenantConfig): Promise<Tenant> {
    const tenant = await this.prisma.forTenant(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tenant WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const current = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      const currentConfig = (current.configJson ?? {}) as TenantConfig;
      const nextConfig = mutate(currentConfig);
      return tx.tenant.update({
        where: { id: tenantId },
        data: { configJson: nextConfig as Prisma.InputJsonValue },
      });
    });

    const serialized = serializeTenant(tenant);
    await this.revalidation.revalidateTenant(serialized);
    return serialized;
  }

  private validateColors(colors: unknown): void {
    if (!colors || typeof colors !== "object" || Array.isArray(colors)) {
      throw new BadRequestException("colors must be an object");
    }

    const invalid = Object.entries(colors as Record<string, unknown>)
      .filter(([, value]) => value !== undefined)
      .filter(([, value]) => !isValidColor(value))
      .map(([field]) => field);

    if (invalid.length > 0) {
      throw new BadRequestException(invalid.map((field) => `${field} must be a valid hex or rgb color`));
    }
  }
}
