import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { BusinessHours, UpsertBusinessHoursRequest } from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { BusinessHoursDto, UpsertBusinessHoursRequestDto } from "../common/dto.js";

const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const toHhMm = (date: Date) => date.toISOString().slice(11, 16);

interface BusinessHoursRow {
  id: string;
  tenantId: string;
  professionalId: string | null;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
}

const toWire = (row: BusinessHoursRow): BusinessHours => ({
  id: row.id,
  tenantId: row.tenantId,
  professionalId: row.professionalId,
  dayOfWeek: row.dayOfWeek,
  startTime: toHhMm(row.startTime),
  endTime: toHhMm(row.endTime),
});

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
    return rows.map(toWire);
  }

  @Post()
  @ApiBody({ type: UpsertBusinessHoursRequestDto })
  @ApiOkResponse({ type: BusinessHoursDto })
  async upsert(@Body() body: UpsertBusinessHoursRequest): Promise<BusinessHours> {
    const { tenantId, role, professionalId: ownProfessionalId } = this.tenantContext.current;
    const professionalId = body.professionalId ?? null;

    if (role === "professional") {
      // Spelled out rather than left to a `!==`: `ownProfessionalId` is
      // `string | undefined` while a tenant-wide request normalises to `null`,
      // so the two cases only differ by an undefined-vs-null accident that a
      // later refactor would quietly erase. Same rejection as
      // AppointmentsController.professionalScope().
      if (!ownProfessionalId) {
        throw new ForbiddenException("this login isn't linked to a professional record");
      }
      if (professionalId !== ownProfessionalId) {
        throw new ForbiddenException("professional logins may only edit their own hours");
      }
    }

    const row = await this.prisma.forTenant(async (tx) => {
      // One window per (scope, weekday): saving Monday again *replaces* Monday
      // rather than adding a second row, which is what "upsert" promised and
      // what the form does — it has no row identity to update, so every save
      // was landing as a new row and the day silently accumulated windows.
      //
      // Scope matters as much as the day: a professional's Monday and the
      // tenant-wide Monday are different rows and must not delete each other.
      // `professionalId: null` compiles to IS NULL, so the tenant-wide scope
      // matches only its own rows.
      await tx.businessHours.deleteMany({ where: { tenantId, professionalId, dayOfWeek: body.dayOfWeek } });

      return tx.businessHours.create({
        data: {
          tenantId,
          professionalId,
          dayOfWeek: body.dayOfWeek,
          startTime: toTime(body.startTime),
          endTime: toTime(body.endTime),
        },
      });
    });

    return toWire(row);
  }

  @Delete(":id")
  @ApiParam({ name: "id" })
  async remove(@Param("id") id: string): Promise<void> {
    const { tenantId, role, professionalId: ownProfessionalId } = this.tenantContext.current;

    await this.prisma.forTenant(async (tx) => {
      const existing = await tx.businessHours.findUniqueOrThrow({ where: { id, tenantId } });
      if (role === "professional") {
        if (!ownProfessionalId) {
          throw new ForbiddenException("this login isn't linked to a professional record");
        }
        if (existing.professionalId !== ownProfessionalId) {
          throw new ForbiddenException("professional logins may only remove their own hours");
        }
      }
      await tx.businessHours.delete({ where: { id, tenantId } });
    });
  }
}
