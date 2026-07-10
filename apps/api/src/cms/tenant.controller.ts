import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Tenant, TenantConfig } from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { serializeTenant } from "../common/serializers.js";
import { TenantDto, UpdateTenantConfigRequestDto } from "../common/dto.js";

@ApiTags("cms-tenant")
@ApiBearerAuth()
@Controller("cms/tenant")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
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
  async updateConfig(@Body("configJson") configJson: TenantConfig): Promise<Tenant> {
    const { tenantId } = this.tenantContext.current;
    const tenant = await this.prisma.forTenant((tx) =>
      tx.tenant.update({ where: { id: tenantId }, data: { configJson: configJson as object } }),
    );
    return serializeTenant(tenant);
  }
}
