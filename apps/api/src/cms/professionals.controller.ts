import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { CreateProfessionalRequest, Professional } from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { serializeProfessional } from "../common/serializers.js";
import { CreateProfessionalRequestDto, ProfessionalDto } from "../common/dto.js";

@ApiTags("cms-professionals")
@ApiBearerAuth()
@Controller("cms/professionals")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfessionalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [ProfessionalDto] })
  async list(): Promise<Professional[]> {
    const { tenantId } = this.tenantContext.current;
    const professionals = await this.prisma.forTenant((tx) => tx.professional.findMany({ where: { tenantId } }));
    return professionals.map(serializeProfessional);
  }

  @Post()
  @Roles("owner")
  @ApiBody({ type: CreateProfessionalRequestDto })
  @ApiOkResponse({ type: ProfessionalDto })
  async create(@Body() body: CreateProfessionalRequest): Promise<Professional> {
    const { tenantId } = this.tenantContext.current;
    const professional = await this.prisma.forTenant((tx) =>
      tx.professional.create({ data: { tenantId, name: body.name } }),
    );
    return serializeProfessional(professional);
  }
}
