import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { CreateServiceRequest, Service } from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { serializeService } from "../common/serializers.js";
import { CreateServiceRequestDto, ServiceDto, UpdateServiceRequestDto } from "../common/dto.js";

@ApiTags("cms-services")
@ApiBearerAuth()
@Controller("cms/services")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [ServiceDto] })
  async list(): Promise<Service[]> {
    const { tenantId } = this.tenantContext.current;
    const services = await this.prisma.forTenant((tx) => tx.service.findMany({ where: { tenantId } }));
    return services.map(serializeService);
  }

  @Post()
  @Roles("owner")
  @ApiBody({ type: CreateServiceRequestDto })
  @ApiOkResponse({ type: ServiceDto })
  async create(@Body() body: CreateServiceRequest): Promise<Service> {
    const { tenantId } = this.tenantContext.current;
    const service = await this.prisma.forTenant((tx) =>
      tx.service.create({
        data: {
          tenantId,
          name: body.name,
          durationMinutes: body.durationMinutes,
          price: body.price,
          serviceProfessionals: {
            create: body.professionalIds.map((professionalId) => ({ tenantId, professionalId })),
          },
        },
      }),
    );
    return serializeService(service);
  }

  @Patch(":id")
  @Roles("owner")
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateServiceRequestDto })
  @ApiOkResponse({ type: ServiceDto })
  async update(@Param("id") id: string, @Body() body: Partial<CreateServiceRequest>): Promise<Service> {
    const { tenantId } = this.tenantContext.current;
    const { professionalIds: _professionalIds, ...rest } = body;
    const service = await this.prisma.forTenant((tx) => tx.service.update({ where: { id, tenantId }, data: rest }));
    return serializeService(service);
  }

  @Delete(":id")
  @Roles("owner")
  @ApiParam({ name: "id" })
  async remove(@Param("id") id: string): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    await this.prisma.forTenant((tx) => tx.service.delete({ where: { id, tenantId } }));
  }
}
