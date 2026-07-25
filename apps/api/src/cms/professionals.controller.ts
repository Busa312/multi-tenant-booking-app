import { randomBytes, createHash } from "crypto";
import { Body, ConflictException, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import * as bcrypt from "bcryptjs";
import type {
  CmsLoginStatus,
  CreateProfessionalRequest,
  InviteProfessionalRequest,
  InviteProfessionalResponse,
  ProfessionalSummary,
  UpcomingAppointmentCountResponse,
  UpdateProfessionalRequest,
} from "@booking/shared-types";
import { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { serializeProfessional } from "../common/serializers.js";
import {
  CreateProfessionalRequestDto,
  InviteProfessionalRequestDto,
  ProfessionalSummaryDto,
  UpdateProfessionalRequestDto,
} from "../common/dto.js";

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PROFESSIONAL_SUMMARY_INCLUDE = {
  serviceProfessionals: true,
  tenantUser: true,
  _count: { select: { appointments: true } },
} satisfies Prisma.ProfessionalInclude;

type ProfessionalWithRelations = Prisma.ProfessionalGetPayload<{ include: typeof PROFESSIONAL_SUMMARY_INCLUDE }>;

function toSummary(p: ProfessionalWithRelations): ProfessionalSummary {
  const cmsLoginStatus: CmsLoginStatus = !p.tenantUser ? "none" : p.tenantUser.inviteTokenHash ? "invited" : "active";
  return {
    ...serializeProfessional(p),
    serviceIds: p.serviceProfessionals.map((sp) => sp.serviceId),
    cmsLoginStatus,
    cmsLoginActive: p.tenantUser?.isActive ?? null,
    hasAppointmentHistory: p._count.appointments > 0,
  };
}

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
  @ApiOkResponse({ type: [ProfessionalSummaryDto] })
  async list(): Promise<ProfessionalSummary[]> {
    const { tenantId } = this.tenantContext.current;
    const professionals = await this.prisma.forTenant((tx) =>
      tx.professional.findMany({
        where: { tenantId },
        include: PROFESSIONAL_SUMMARY_INCLUDE,
      }),
    );
    return professionals.map(toSummary);
  }

  @Post()
  @Roles("owner")
  @ApiBody({ type: CreateProfessionalRequestDto })
  @ApiOkResponse({ type: ProfessionalSummaryDto })
  async create(@Body() body: CreateProfessionalRequest): Promise<ProfessionalSummary> {
    const { tenantId } = this.tenantContext.current;
    const professional = await this.prisma.forTenant((tx) =>
      tx.professional.create({
        data: {
          tenantId,
          name: body.name,
          serviceProfessionals: {
            create: (body.serviceIds ?? []).map((serviceId) => ({ tenantId, serviceId })),
          },
        },
        include: PROFESSIONAL_SUMMARY_INCLUDE,
      }),
    );
    return toSummary(professional);
  }

  // R40: serviceIds (when provided) fully replaces this professional's
  // ServiceProfessional rows — a diff-free delete-then-recreate within the
  // same transaction as the professional update, no separate approval step.
  @Patch(":id")
  @Roles("owner")
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateProfessionalRequestDto })
  @ApiOkResponse({ type: ProfessionalSummaryDto })
  async update(@Param("id") id: string, @Body() body: UpdateProfessionalRequest): Promise<ProfessionalSummary> {
    const { tenantId } = this.tenantContext.current;
    const { serviceIds, ...rest } = body;

    const professional = await this.prisma.forTenant(async (tx) => {
      if (serviceIds !== undefined) {
        await tx.serviceProfessional.deleteMany({ where: { tenantId, professionalId: id } });
        if (serviceIds.length > 0) {
          await tx.serviceProfessional.createMany({
            data: serviceIds.map((serviceId) => ({ tenantId, professionalId: id, serviceId })),
          });
        }
      }
      return tx.professional.update({
        where: { id, tenantId },
        data: rest,
        include: PROFESSIONAL_SUMMARY_INCLUDE,
      });
    });

    return toSummary(professional);
  }

  // R80: hard delete only when this professional has never had any
  // appointment (past or future) — anyone with history can only be
  // deactivated via PATCH { isActive: false }, so booking history stays
  // intact and queryable.
  @Delete(":id")
  @Roles("owner")
  @ApiParam({ name: "id" })
  async remove(@Param("id") id: string): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    await this.prisma.forTenant(async (tx) => {
      const appointmentCount = await tx.appointment.count({ where: { tenantId, professionalId: id } });
      if (appointmentCount > 0) {
        throw new ConflictException(
          "This professional has appointment history and can only be deactivated, not deleted",
        );
      }
      await tx.professional.delete({ where: { id, tenantId } });
    });
  }

  // R70: lets the CMS show "N upcoming appointments" in the deactivation
  // confirmation *before* the owner confirms — server-computed so it isn't
  // client-side date/timezone math against a bulk appointment fetch.
  @Get(":id/upcoming-count")
  @Roles("owner")
  @ApiParam({ name: "id" })
  @ApiOkResponse({ type: Number })
  async upcomingCount(@Param("id") id: string): Promise<UpcomingAppointmentCountResponse> {
    const { tenantId } = this.tenantContext.current;
    const count = await this.prisma.forTenant((tx) =>
      tx.appointment.count({
        where: { tenantId, professionalId: id, status: "booked", startAt: { gte: new Date() } },
      }),
    );
    return { count };
  }

  // R50: creates the TenantUser (role "professional") with a hashed,
  // expiring invite token and an unusable random placeholder password —
  // login stays impossible via the normal email+password path until
  // /cms/auth/set-password consumes the token. Email delivery isn't wired up
  // (no provider integrated anywhere in this codebase yet); the raw token is
  // returned here so the owner can copy the set-password link and send it
  // manually, same as the customer magic-link flow is stubbed elsewhere.
  @Post(":id/invite")
  @Roles("owner")
  @ApiParam({ name: "id" })
  @ApiBody({ type: InviteProfessionalRequestDto })
  async invite(
    @Param("id") id: string,
    @Body() body: InviteProfessionalRequest,
  ): Promise<InviteProfessionalResponse> {
    const { tenantId } = this.tenantContext.current;
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);
    const placeholderPasswordHash = await bcrypt.hash(randomBytes(16).toString("hex"), 10);

    try {
      const user = await this.prisma.forTenant(async (tx) => {
        const professional = await tx.professional.findUniqueOrThrow({ where: { id, tenantId } });
        const existing = await tx.tenantUser.findUnique({ where: { professionalId: professional.id } });
        if (existing) {
          throw new ConflictException("This professional already has a CMS login");
        }

        return tx.tenantUser.create({
          data: {
            tenantId,
            professionalId: professional.id,
            email: body.email,
            passwordHash: placeholderPasswordHash,
            role: "professional",
            inviteTokenHash: tokenHash,
            inviteTokenExpiresAt: expiresAt,
          },
        });
      });

      return { tenantId, tenantUserId: user.id, email: user.email, token, expiresAt: expiresAt.toISOString() };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Email "${body.email}" is already in use for this tenant`);
      }
      throw err;
    }
  }
}
