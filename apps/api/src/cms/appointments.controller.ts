import { Controller, ForbiddenException, Get, NotImplementedException, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Appointment } from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { serializeAppointment } from "../common/serializers.js";
import { AppointmentDto } from "../common/dto.js";

/**
 * `professional` logins see/act only on their own appointments; `owner` sees
 * all (system_design.md §6). Reschedule is left as a stub — it needs the
 * same slot-conflict check as the public booking flow (see PublicController).
 */
@ApiTags("cms-appointments")
@ApiBearerAuth()
@Controller("cms/appointments")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [AppointmentDto] })
  async list(): Promise<Appointment[]> {
    const { tenantId, role, professionalId } = this.tenantContext.current;
    const appointments = await this.prisma.forTenant((tx) =>
      tx.appointment.findMany({
        where: { tenantId, ...(role === "professional" ? { professionalId } : {}) },
        orderBy: { startAt: "asc" },
      }),
    );
    return appointments.map(serializeAppointment);
  }

  @Post(":id/cancel")
  @ApiParam({ name: "id" })
  @ApiOkResponse({ type: AppointmentDto })
  async cancel(@Param("id") id: string): Promise<Appointment> {
    const { tenantId, role, professionalId } = this.tenantContext.current;

    const appointment = await this.prisma.forTenant(async (tx) => {
      const existing = await tx.appointment.findUniqueOrThrow({ where: { id, tenantId } });
      if (role === "professional" && existing.professionalId !== professionalId) {
        throw new ForbiddenException("professional logins may only cancel their own appointments");
      }
      return tx.appointment.update({ where: { id, tenantId }, data: { status: "cancelled" } });
    });
    return serializeAppointment(appointment);
  }

  @Post(":id/reschedule")
  @ApiParam({ name: "id" })
  @ApiOkResponse({ type: AppointmentDto })
  reschedule(@Param("id") _id: string): Promise<Appointment> {
    throw new NotImplementedException("Reschedule (slot-conflict check + duration lookup) is not yet implemented");
  }
}
