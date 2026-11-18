import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type {
  CreateServiceCategoryRequest,
  ReorderServiceCategoriesRequest,
  ServiceCategory,
  UpdateServiceCategoryRequest,
} from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { serializeServiceCategory } from "../common/serializers.js";
import {
  CreateServiceCategoryRequestDto,
  ReorderServiceCategoriesRequestDto,
  ServiceCategoryDto,
  UpdateServiceCategoryRequestDto,
} from "../common/dto.js";
import { enabledLocalesOf, validateLocalizedText } from "../common/i18n-validation.js";
import { RevalidationService } from "./revalidation.service.js";
import { categoryIdIn, nextServicePosition, validateOrder } from "./service-order.js";

const NAME_MAX = 80;

function validateName(name: unknown): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) throw new BadRequestException("name is required");
  if (trimmed.length > NAME_MAX) throw new BadRequestException(`name must be at most ${NAME_MAX} characters`);
  return trimmed;
}

const ORDER = [{ position: "asc" }, { createdAt: "asc" }] satisfies Prisma.ServiceCategoryOrderByWithRelationInput[];

/**
 * R510: the salon's service categories — names (translatable, R160) and order.
 * Everyone signed in can read them (the services list is grouped by them);
 * only the owner changes them, as with services.
 */
@ApiTags("cms-service-categories")
@ApiBearerAuth()
@Controller("cms/service-categories")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceCategoriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [ServiceCategoryDto] })
  async list(): Promise<ServiceCategory[]> {
    const { tenantId } = this.tenantContext.current;
    const categories = await this.prisma.forTenant((tx) => tx.serviceCategory.findMany({ where: { tenantId }, orderBy: ORDER }));
    return categories.map(serializeServiceCategory);
  }

  @Post()
  @Roles("owner")
  @ApiBody({ type: CreateServiceCategoryRequestDto })
  @ApiOkResponse({ type: ServiceCategoryDto })
  async create(@Body() body: CreateServiceCategoryRequest): Promise<ServiceCategory> {
    const { tenantId } = this.tenantContext.current;
    const name = validateName(body?.name);
    const category = await this.prisma.forTenant(async (tx) => {
      const { _max } = await tx.serviceCategory.aggregate({ where: { tenantId }, _max: { position: true } });
      return tx.serviceCategory.create({
        data: {
          tenantId,
          name,
          nameI18n: validateLocalizedText(body?.nameI18n, "nameI18n", await this.enabledLocales(tx, tenantId)),
          // A new category goes last.
          position: (_max.position ?? -1) + 1,
        },
      });
    });
    await this.revalidate(tenantId);
    return serializeServiceCategory(category);
  }

  @Patch(":id")
  @Roles("owner")
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateServiceCategoryRequestDto })
  @ApiOkResponse({ type: ServiceCategoryDto })
  async update(@Param("id") id: string, @Body() body: UpdateServiceCategoryRequest): Promise<ServiceCategory> {
    const { tenantId } = this.tenantContext.current;
    const category = await this.prisma.forTenant(async (tx) => {
      await categoryIdIn(tx, tenantId, id);
      const data: Prisma.ServiceCategoryUpdateInput = {};
      if (body?.name !== undefined) data.name = validateName(body.name);
      if (body?.nameI18n !== undefined) {
        data.nameI18n = validateLocalizedText(body.nameI18n, "nameI18n", await this.enabledLocales(tx, tenantId));
      }
      return tx.serviceCategory.update({ where: { id, tenantId }, data });
    });
    await this.revalidate(tenantId);
    return serializeServiceCategory(category);
  }

  /** R510: the category goes; its services stay, at the end of the uncategorized ones, in their order. */
  @Delete(":id")
  @Roles("owner")
  @ApiParam({ name: "id" })
  async remove(@Param("id") id: string): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    await this.prisma.forTenant(async (tx) => {
      await categoryIdIn(tx, tenantId, id);
      const services = await tx.service.findMany({
        where: { tenantId, categoryId: id },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      const first = await nextServicePosition(tx, tenantId, null);
      for (const [offset, service] of services.entries()) {
        await tx.service.update({ where: { id: service.id, tenantId }, data: { categoryId: null, position: first + offset } });
      }
      await tx.serviceCategory.delete({ where: { id, tenantId } });
    });
    await this.revalidate(tenantId);
  }

  /** R510: every category's id, first to last. */
  @Put("order")
  @Roles("owner")
  @ApiBody({ type: ReorderServiceCategoriesRequestDto })
  @ApiOkResponse({ type: [ServiceCategoryDto] })
  async reorder(@Body() body: ReorderServiceCategoriesRequest): Promise<ServiceCategory[]> {
    const { tenantId } = this.tenantContext.current;
    await this.prisma.forTenant(async (tx) => {
      const current = await tx.serviceCategory.findMany({ where: { tenantId }, select: { id: true } });
      const ids = validateOrder(body?.ids, current.map((category) => category.id));
      for (const [position, id] of ids.entries()) {
        await tx.serviceCategory.update({ where: { id, tenantId }, data: { position } });
      }
    });
    await this.revalidate(tenantId);
    return this.list();
  }

  private async enabledLocales(tx: Prisma.TransactionClient, tenantId: string): Promise<string[]> {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { configJson: true } });
    return enabledLocalesOf(tenant.configJson);
  }

  /** The booking site shows the categories; best effort, as for services. */
  private async revalidate(tenantId: string): Promise<void> {
    const tenant = await this.prisma.forTenant((tx) =>
      tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { subdomain: true, customDomain: true, domainVerifiedAt: true } }),
    );
    await this.revalidation.revalidateTenant({ ...tenant, domainVerifiedAt: tenant.domainVerifiedAt?.toISOString() ?? null });
  }
}
