import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { CreateServiceRequest, ServiceSummary, UpdateServiceRequest } from "@booking/shared-types";
import { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { serializeService } from "../common/serializers.js";
import { CreateServiceRequestDto, ServiceSummaryDto, UpdateServiceRequestDto } from "../common/dto.js";
import {
  enabledLocalesOf,
  validateLocalizedText,
  LOCALIZED_TEXT_MAX,
} from "../common/i18n-validation.js";
import { RevalidationService } from "./revalidation.service.js";

const SERVICE_SUMMARY_INCLUDE = {
  serviceProfessionals: true,
  _count: { select: { appointmentServices: true } },
} satisfies Prisma.ServiceInclude;

type ServiceWithRelations = Prisma.ServiceGetPayload<{ include: typeof SERVICE_SUMMARY_INCLUDE }>;

function toSummary(s: ServiceWithRelations): ServiceSummary {
  return {
    ...serializeService(s),
    professionalIds: s.serviceProfessionals.map((sp) => sp.professionalId),
    hasAppointmentHistory: s._count.appointmentServices > 0,
  };
}

function parsePrice(price: string): Prisma.Decimal {
  let value: Prisma.Decimal;
  try {
    value = new Prisma.Decimal(typeof price === "string" ? price.trim() : price);
  } catch {
    throw new BadRequestException("price must be a positive number");
  }
  if (!value.isFinite() || value.lessThanOrEqualTo(0)) {
    throw new BadRequestException("price must be a positive number");
  }
  return value;
}

function validateDuration(durationMinutes: number): number {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new BadRequestException("durationMinutes must be a positive whole number of minutes");
  }
  return durationMinutes;
}

function validateName(name: string): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    throw new BadRequestException("name is required");
  }
  return trimmed;
}

@ApiTags("cms-services")
@ApiBearerAuth()
@Controller("cms/services")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [ServiceSummaryDto] })
  async list(): Promise<ServiceSummary[]> {
    const { tenantId } = this.tenantContext.current;
    const services = await this.prisma.forTenant((tx) =>
      tx.service.findMany({ where: { tenantId }, include: SERVICE_SUMMARY_INCLUDE, orderBy: { createdAt: "asc" } }),
    );
    return services.map(toSummary);
  }

  @Post()
  @Roles("owner")
  @ApiBody({ type: CreateServiceRequestDto })
  @ApiOkResponse({ type: ServiceSummaryDto })
  async create(@Body() body: CreateServiceRequest): Promise<ServiceSummary> {
    const { tenantId } = this.tenantContext.current;
    const name = validateName(body.name);
    const price = parsePrice(body.price);
    const durationMinutes = validateDuration(body.durationMinutes);

    const service = await this.prisma.forTenant(async (tx) => {
      const locales = await this.enabledLocales(tx, tenantId);
      return tx.service.create({
        data: {
          tenantId,
          name,
          // R160: the plain columns above hold the default locale

          nameI18n: validateLocalizedText(body.nameI18n, "nameI18n", locales),
          description: body.description ?? null,
          descriptionI18n: validateLocalizedText(
            body.descriptionI18n,
            "descriptionI18n",
            locales,
            LOCALIZED_TEXT_MAX,
          ),
          durationMinutes,
          price,
          serviceProfessionals: {
            create: (body.professionalIds ?? []).map((professionalId) => ({ tenantId, professionalId })),
          },
        },
        include: SERVICE_SUMMARY_INCLUDE,
      });
    });

    await this.revalidate(tenantId);
    return toSummary(service);
  }

  @Patch(":id")
  @Roles("owner")
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateServiceRequestDto })
  @ApiOkResponse({ type: ServiceSummaryDto })
  async update(@Param("id") id: string, @Body() body: UpdateServiceRequest): Promise<ServiceSummary> {
    const { tenantId } = this.tenantContext.current;
    const { professionalIds, name, price, durationMinutes, nameI18n, descriptionI18n, ...rest } = body;

    const data: Prisma.ServiceUpdateInput = { ...rest };
    if (name !== undefined) {
      data.name = validateName(name);
    }
    if (price !== undefined) {
      data.price = parsePrice(price);
    }
    if (durationMinutes !== undefined) {
      data.durationMinutes = validateDuration(durationMinutes);
    }

    const service = await this.prisma.forTenant(async (tx) => {
      if (nameI18n !== undefined || descriptionI18n !== undefined) {
        const locales = await this.enabledLocales(tx, tenantId);
        if (nameI18n !== undefined) {
          data.nameI18n = validateLocalizedText(nameI18n, "nameI18n", locales);
        }
        if (descriptionI18n !== undefined) {
          data.descriptionI18n = validateLocalizedText(
            descriptionI18n,
            "descriptionI18n",
            locales,
            LOCALIZED_TEXT_MAX,
          );
        }
      }
      if (professionalIds !== undefined) {
        await tx.serviceProfessional.deleteMany({ where: { tenantId, serviceId: id } });
        if (professionalIds.length > 0) {
          await tx.serviceProfessional.createMany({
            data: professionalIds.map((professionalId) => ({ tenantId, serviceId: id, professionalId })),
          });
        }
      }
      return tx.service.update({ where: { id, tenantId }, data, include: SERVICE_SUMMARY_INCLUDE });
    });

    await this.revalidate(tenantId);
    return toSummary(service);
  }

  @Delete(":id")
  @Roles("owner")
  @ApiParam({ name: "id" })
  async remove(@Param("id") id: string): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    await this.prisma.forTenant(async (tx) => {
      const appointmentCount = await tx.appointmentService.count({ where: { tenantId, serviceId: id } });
      if (appointmentCount > 0) {
        throw new ConflictException("This service has appointment history and can only be deactivated, not deleted");
      }
      await tx.service.delete({ where: { id, tenantId } });
    });

    await this.revalidate(tenantId);
  }

  private async enabledLocales(tx: Prisma.TransactionClient, tenantId: string): Promise<string[]> {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { configJson: true } });
    return enabledLocalesOf(tenant.configJson);
  }

  private async revalidate(tenantId: string): Promise<void> {
    const tenant = await this.prisma.forTenant((tx) =>
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { subdomain: true, customDomain: true, domainVerifiedAt: true },
      }),
    );
    await this.revalidation.revalidateTenant({
      subdomain: tenant.subdomain,
      customDomain: tenant.customDomain,
      domainVerifiedAt: tenant.domainVerifiedAt?.toISOString() ?? null,
    });
  }
}
