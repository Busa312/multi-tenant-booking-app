import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { BusinessHours, UpsertBusinessHoursRequest } from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { BusinessHoursDto, UpsertBusinessHoursRequestDto } from "../common/dto.js";

const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const toHhMm = (date: Date) => date.toISOString().slice(11, 16);

/**
 * Owner can set tenant-wide or any professional's hours; a `professional`
 * login may only touch their own (system_design.md §6). RLS can't express
 * this (it has no concept of roles within a tenant), so it's enforced here.
 */
@ApiTags("cms-business-hours")
@ApiBearerAuth()
@Controller("cms/business-hours")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessHoursController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [BusinessHoursDto] })
  async list(): Promise<BusinessHours[]> {
    const { tenantId } = this.tenantContext.current;
    const rows = await this.prisma.forTenant((tx) => tx.businessHours.findMany({ where: { tenantId } }));
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      professionalId: row.professionalId,
      dayOfWeek: row.dayOfWeek,
      startTime: toHhMm(row.startTime),
      endTime: toHhMm(row.endTime),
    }));
  }

  @Post()
  @ApiBody({ type: UpsertBusinessHoursRequestDto })
  @ApiOkResponse({ type: BusinessHoursDto })
  upsert(@Body() body: UpsertBusinessHoursRequest): Promise<BusinessHours> {
    const { tenantId, role, professionalId: ownProfessionalId } = this.tenantContext.current;

    if (role === "professional" && body.professionalId !== ownProfessionalId) {
      throw new ForbiddenException("professional logins may only edit their own hours");
    }

    return this.prisma
      .forTenant((tx) =>
        tx.businessHours.create({
          data: {
            tenantId,
            professionalId: body.professionalId ?? null,
            dayOfWeek: body.dayOfWeek,
            startTime: toTime(body.startTime),
            endTime: toTime(body.endTime),
          },
        }),
      )
      .then((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        professionalId: row.professionalId,
        dayOfWeek: row.dayOfWeek,
        startTime: toHhMm(row.startTime),
        endTime: toHhMm(row.endTime),
      }));
  }
}
