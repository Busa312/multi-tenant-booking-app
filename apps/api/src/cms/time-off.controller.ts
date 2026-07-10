import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { CreateTimeOffRequest, TimeOff } from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { serializeTimeOff } from "../common/serializers.js";
import { CreateTimeOffRequestDto, TimeOffDto } from "../common/dto.js";

/** Same owner-vs-own-professional restriction as BusinessHoursController. */
@ApiTags("cms-time-off")
@ApiBearerAuth()
@Controller("cms/time-off")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeOffController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [TimeOffDto] })
  async list(): Promise<TimeOff[]> {
    const { tenantId } = this.tenantContext.current;
    const timeOff = await this.prisma.forTenant((tx) => tx.timeOff.findMany({ where: { tenantId } }));
    return timeOff.map(serializeTimeOff);
  }

  @Post()
  @ApiBody({ type: CreateTimeOffRequestDto })
  @ApiOkResponse({ type: TimeOffDto })
  async create(@Body() body: CreateTimeOffRequest): Promise<TimeOff> {
    const { tenantId, role, professionalId: ownProfessionalId } = this.tenantContext.current;

    if (role === "professional" && body.professionalId !== ownProfessionalId) {
      throw new ForbiddenException("professional logins may only block off their own time");
    }

    const timeOff = await this.prisma.forTenant((tx) =>
      tx.timeOff.create({
        data: {
          tenantId,
          professionalId: body.professionalId ?? null,
          startAt: body.startAt,
          endAt: body.endAt,
          reason: body.reason,
        },
      }),
    );
    return serializeTimeOff(timeOff);
  }

  @Delete(":id")
  @ApiParam({ name: "id" })
  async remove(@Param("id") id: string): Promise<void> {
    const { tenantId, role, professionalId: ownProfessionalId } = this.tenantContext.current;

    await this.prisma.forTenant(async (tx) => {
      const existing = await tx.timeOff.findUniqueOrThrow({ where: { id, tenantId } });
      if (role === "professional" && existing.professionalId !== ownProfessionalId) {
        throw new ForbiddenException("professional logins may only remove their own time-off");
      }
      await tx.timeOff.delete({ where: { id, tenantId } });
    });
  }
}
