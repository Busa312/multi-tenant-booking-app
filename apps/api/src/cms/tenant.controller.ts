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
import {
  TenantDto,
  UpdateTenantColorsRequestDto,
  UpdateTenantConfigRequestDto,
  UpdateTenantSeoRequestDto,
} from "../common/dto.js";
import { RevalidationService } from "./revalidation.service.js";
import { isValidColor } from "./color-validation.js";
import { validateBusinessInfo, validateSeo } from "./seo-validation.js";

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
    // The dedicated /seo endpoint is not the only door into these keys — this
    // generic one can write them too, so it has to apply the same rules or the
    // validation is optional in practice.
    if (next.seo !== undefined) {
      next.seo = validateSeo(next.seo);
    }
    if (next.business !== undefined) {
      next.business = validateBusinessInfo(next.business);
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

  /**
   * Search-engine settings and the salon's real business details.
   *
   * A dedicated endpoint rather than `PATCH /config` for the same reason
   * `/colors` is one: that endpoint's shallow top-level merge would let a caller
   * sending `{ seo: { title } }` silently wipe the description.
   *
   * Each sub-object provided is **replaced**, not merged — unlike `/colors`. A
   * merge cannot express deletion (`{ description: undefined }` doesn't remove
   * anything), so a tenant could never clear a description they'd typed. The
   * form always holds and sends every field, so a replace is the honest
   * semantic, and it needs no companion reset endpoint.
   */
  @Patch("seo")
  @Roles("owner")
  @ApiBody({ type: UpdateTenantSeoRequestDto })
  @ApiOkResponse({ type: TenantDto })
  async updateSeo(@Body("seo") seo: unknown, @Body("business") business: unknown): Promise<Tenant> {
    if (seo === undefined && business === undefined) {
      throw new BadRequestException("send seo, business, or both");
    }
    // Validated before the transaction opens: a rejected payload shouldn't take
    // a row lock.
    const nextSeo = seo === undefined ? undefined : validateSeo(seo);
    const nextBusiness = business === undefined ? undefined : validateBusinessInfo(business);

    const { tenantId } = this.tenantContext.current;
    return this.mutateConfig(tenantId, (current) => ({
      ...current,
      ...(nextSeo === undefined ? {} : { seo: nextSeo }),
      ...(nextBusiness === undefined ? {} : { business: nextBusiness }),
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
