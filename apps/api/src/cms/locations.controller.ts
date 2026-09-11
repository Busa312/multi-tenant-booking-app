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
import type { CreateLocationRequest, LocationSummary, UpdateLocationRequest } from "@booking/shared-types";
import { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { serializeLocation } from "../common/serializers.js";
import { CreateLocationRequestDto, LocationSummaryDto, UpdateLocationRequestDto } from "../common/dto.js";
import { enabledLocalesOf, validateLocalizedText, LOCALIZED_NAME_MAX } from "../common/i18n-validation.js";
import { RevalidationService } from "./revalidation.service.js";

const LOCATION_SUMMARY_INCLUDE = {
  professionals: { select: { id: true } },
  // R190: any appointment ever

  _count: { select: { appointments: true } },
} satisfies Prisma.LocationInclude;

type LocationWithRelations = Prisma.LocationGetPayload<{ include: typeof LOCATION_SUMMARY_INCLUDE }>;

function toSummary(l: LocationWithRelations): LocationSummary {
  return {
    ...serializeLocation(l),
    professionalIds: l.professionals.map((p) => p.id),
    hasAppointmentHistory: l._count.appointments > 0,
  };
}

function requireText(value: unknown, field: string, maxLength = LOCALIZED_NAME_MAX): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    throw new BadRequestException(`${field} is required`);
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
}

function optionalText(value: string | null | undefined, maxLength = LOCALIZED_NAME_MAX): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestException(`must be at most ${maxLength} characters`);
  }
  return trimmed;
}

function parseCoordinates(
  latitude: string | null | undefined,
  longitude: string | null | undefined,
): { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null } {
  const lat = typeof latitude === "string" && latitude.trim() !== "" ? latitude.trim() : null;
  const lng = typeof longitude === "string" && longitude.trim() !== "" ? longitude.trim() : null;

  if (lat === null && lng === null) {
    return { latitude: null, longitude: null };
  }
  if (lat === null || lng === null) {
    throw new BadRequestException("latitude and longitude must be set together, or neither");
  }

  const parse = (value: string, field: string, bound: number): Prisma.Decimal => {
    let decimal: Prisma.Decimal;
    try {
      decimal = new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException(`${field} must be a number`);
    }
    if (!decimal.isFinite() || decimal.lessThan(-bound) || decimal.greaterThan(bound)) {
      throw new BadRequestException(`${field} must be between -${bound} and ${bound}`);
    }
    return decimal;
  };

  return { latitude: parse(lat, "latitude", 90), longitude: parse(lng, "longitude", 180) };
}

// R150: a tenant's branches
@ApiTags("cms-locations")
@ApiBearerAuth()
@Controller("cms/locations")
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [LocationSummaryDto] })
  async list(): Promise<LocationSummary[]> {
    const { tenantId } = this.tenantContext.current;
    const locations = await this.prisma.forTenant((tx) =>
      tx.location.findMany({
        where: { tenantId },
        include: LOCATION_SUMMARY_INCLUDE,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      }),
    );
    return locations.map(toSummary);
  }

  @Post()
  @Roles("owner")
  @ApiBody({ type: CreateLocationRequestDto })
  @ApiOkResponse({ type: LocationSummaryDto })
  async create(@Body() body: CreateLocationRequest): Promise<LocationSummary> {
    const { tenantId } = this.tenantContext.current;

    const location = await this.prisma.forTenant(async (tx) => {
      const locales = enabledLocalesOf(
        (await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { configJson: true } })).configJson,
      );
      const coordinates = parseCoordinates(body.latitude, body.longitude);
      const position = body.position ?? (await this.nextPosition(tx, tenantId));

      return tx.location.create({
        data: {
          tenantId,
          name: requireText(body.name, "name"),
          nameI18n: validateLocalizedText(body.nameI18n, "nameI18n", locales),
          addressLine: requireText(body.addressLine, "addressLine"),
          addressLineI18n: validateLocalizedText(body.addressLineI18n, "addressLineI18n", locales),
          city: optionalText(body.city),
          phone: optionalText(body.phone),
          ...coordinates,
          position,
        },
        include: LOCATION_SUMMARY_INCLUDE,
      });
    });

    await this.revalidate(tenantId);
    return toSummary(location);
  }

  @Patch(":id")
  @Roles("owner")
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateLocationRequestDto })
  @ApiOkResponse({ type: LocationSummaryDto })
  async update(@Param("id") id: string, @Body() body: UpdateLocationRequest): Promise<LocationSummary> {
    const { tenantId } = this.tenantContext.current;

    const location = await this.prisma.forTenant(async (tx) => {
      const locales = enabledLocalesOf(
        (await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { configJson: true } })).configJson,
      );

      const data: Prisma.LocationUpdateInput = {};
      if (body.name !== undefined) {
        data.name = requireText(body.name, "name");
      }
      if (body.nameI18n !== undefined) {
        data.nameI18n = validateLocalizedText(body.nameI18n, "nameI18n", locales);
      }
      if (body.addressLine !== undefined) {
        data.addressLine = requireText(body.addressLine, "addressLine");
      }
      if (body.addressLineI18n !== undefined) {
        data.addressLineI18n = validateLocalizedText(body.addressLineI18n, "addressLineI18n", locales);
      }
      if (body.city !== undefined) {
        data.city = optionalText(body.city);
      }
      if (body.phone !== undefined) {
        data.phone = optionalText(body.phone);
      }

      if (body.latitude !== undefined || body.longitude !== undefined) {
        Object.assign(data, parseCoordinates(body.latitude, body.longitude));
      }
      if (body.position !== undefined) {
        data.position = body.position;
      }
      if (body.isActive !== undefined) {
        data.isActive = body.isActive;
      }

      return tx.location.update({ where: { id, tenantId }, data, include: LOCATION_SUMMARY_INCLUDE });
    });

    await this.revalidate(tenantId);
    return toSummary(location);
  }

  @Delete(":id")
  @Roles("owner")
  @ApiParam({ name: "id" })
  async remove(@Param("id") id: string): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    await this.prisma.forTenant(async (tx) => {
      const appointmentCount = await tx.appointment.count({ where: { tenantId, locationId: id } });
      if (appointmentCount > 0) {
        throw new ConflictException("This location has appointment history and can only be deactivated, not deleted");
      }
      await tx.location.delete({ where: { id, tenantId } });
    });

    await this.revalidate(tenantId);
  }

  private async nextPosition(tx: Prisma.TransactionClient, tenantId: string): Promise<number> {
    const last = await tx.location.aggregate({ where: { tenantId }, _max: { position: true } });
    return (last._max.position ?? -1) + 1;
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
