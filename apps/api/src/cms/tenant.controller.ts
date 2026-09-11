import { BadRequestException, Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  LocalizedText,
  Tenant,
  TenantColors,
  TenantConfig,
  UpdateTenantCopyRequest,
  UpdateTenantLocalesRequest,
} from "@booking/shared-types";
import { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { serializeTenant } from "../common/serializers.js";
import {
  TenantDto,
  UpdateTenantColorsRequestDto,
  UpdateTenantConfigRequestDto,
  UpdateTenantCopyRequestDto,
  UpdateTenantLocalesRequestDto,
} from "../common/dto.js";
import { enabledLocalesOf, validateLocalizedText, SUPPORTED_CONTENT_LOCALES } from "../common/i18n-validation.js";
import { RevalidationService } from "./revalidation.service.js";
import { isValidColor } from "./color-validation.js";

const COPY_TITLE_MAX = 70;
const COPY_DESCRIPTION_MAX = 200;

type TenantCopy = NonNullable<TenantConfig["copy"]>;

function assign<K extends keyof TenantCopy>(copy: TenantCopy, key: K, value: TenantCopy[K] | undefined): void {
  if (value === undefined) {
    delete copy[key];
  } else {
    copy[key] = value;
  }
}

function asLocalizedText(value: unknown): LocalizedText | undefined {
  return value === Prisma.DbNull || value === null || value === undefined ? undefined : (value as LocalizedText);
}

function stripCopy(config: TenantConfig): TenantConfig {
  const { copy: _copy, ...rest } = config;
  return rest;
}

@ApiTags("cms-tenant")
@ApiBearerAuth()
@Controller("cms/tenant")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Get()
  @ApiOkResponse({ type: TenantDto })
  async getTenant(): Promise<Tenant> {
    const { tenantId } = this.tenantContext.current;
    const tenant = await this.prisma.forTenant((tx) => tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }));
    return serializeTenant(tenant);
  }

  @Patch("config")
  @Roles("owner")
  @ApiBody({ type: UpdateTenantConfigRequestDto })
  @ApiOkResponse({ type: TenantDto })
  async updateConfig(@Body("configJson") configJson: unknown): Promise<Tenant> {
    if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
      throw new BadRequestException("configJson must be an object");
    }
    const next = configJson as TenantConfig;
    if (next.colors !== undefined) {
      this.validateColors(next.colors);
    }

    const { tenantId } = this.tenantContext.current;

    return this.mutateConfig(tenantId, (current) => ({ ...current, ...next }));
  }

  @Patch("colors")
  @Roles("owner")
  @ApiBody({ type: UpdateTenantColorsRequestDto })
  @ApiOkResponse({ type: TenantDto })
  async updateColors(@Body("colors") colors: unknown): Promise<Tenant> {
    this.validateColors(colors);
    const { tenantId } = this.tenantContext.current;

    return this.mutateConfig(tenantId, (current) => ({
      ...current,
      colors: { ...current.colors, ...(colors as TenantColors) },
    }));
  }

  // R170: the public site's title and description
  /**
   * R160: which languages the public site publishes in.
   *
   * The tenant's *default* locale — the first entry, and the one every plain
   * `name`/`description` column holds — is pinned. Dropping it would leave the
   * stored text labelled as a language it isn't written in: `localized()` falls
   * back to the plain column for any missing translation, so removing "en" from
   * a tenant whose columns hold English would serve English text as Georgian.
   * Switching the default is a data migration, not a settings toggle.
   */
  @Patch("locales")
  @Roles("owner")
  @ApiBody({ type: UpdateTenantLocalesRequestDto })
  @ApiOkResponse({ type: TenantDto })
  async updateLocales(@Body() body: UpdateTenantLocalesRequest): Promise<Tenant> {
    const requested = Array.isArray(body?.enabledLocales) ? body.enabledLocales : null;
    if (!requested) {
      throw new BadRequestException("enabledLocales must be an array");
    }

    const unsupported = requested.filter((locale) => !SUPPORTED_CONTENT_LOCALES.includes(locale));
    if (unsupported.length > 0) {
      throw new BadRequestException(`Unsupported locale(s): ${unsupported.join(", ")}`);
    }
    if (requested.length === 0) {
      throw new BadRequestException("At least one language must stay enabled");
    }

    const { tenantId } = this.tenantContext.current;
    return this.mutateConfig(tenantId, (current) => {
      const defaultLocale = enabledLocalesOf(current)[0] as string;
      if (!requested.includes(defaultLocale)) {
        throw new BadRequestException(
          `"${defaultLocale}" is this site's main language and can't be turned off`,
        );
      }
      // Kept first whatever order the client sent, so the default never moves.
      const ordered = [defaultLocale, ...SUPPORTED_CONTENT_LOCALES.filter(
        (locale) => locale !== defaultLocale && requested.includes(locale),
      )];
      return { ...current, enabledLocales: ordered };
    });
  }

  @Patch("copy")
  @Roles("owner")
  @ApiBody({ type: UpdateTenantCopyRequestDto })
  @ApiOkResponse({ type: TenantDto })
  async updateCopy(@Body() body: UpdateTenantCopyRequest): Promise<Tenant> {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("body must be an object");
    }
    const { tenantId } = this.tenantContext.current;

    return this.mutateConfig(tenantId, (current) => {
      const locales = enabledLocalesOf(current);
      const copy = { ...current.copy };

      if (body.title !== undefined) {
        assign(copy, "title", this.validatePlainCopy(body.title, "title", COPY_TITLE_MAX));
      }
      if (body.description !== undefined) {
        assign(copy, "description", this.validatePlainCopy(body.description, "description", COPY_DESCRIPTION_MAX));
      }
      if (body.titleI18n !== undefined) {
        assign(copy, "titleI18n", asLocalizedText(validateLocalizedText(body.titleI18n, "titleI18n", locales, COPY_TITLE_MAX)));
      }
      if (body.descriptionI18n !== undefined) {
        assign(
          copy,
          "descriptionI18n",
          asLocalizedText(
            validateLocalizedText(body.descriptionI18n, "descriptionI18n", locales, COPY_DESCRIPTION_MAX),
          ),
        );
      }

      return Object.keys(copy).length > 0 ? { ...current, copy } : stripCopy(current);
    });
  }

  @Post("colors/reset")
  @Roles("owner")
  @ApiOkResponse({ type: TenantDto })
  async resetColors(): Promise<Tenant> {
    const { tenantId } = this.tenantContext.current;

    return this.mutateConfig(tenantId, (current) => {
      const { colors: _colors, ...rest } = current;
      return rest;
    });
  }

  private async mutateConfig(tenantId: string, mutate: (current: TenantConfig) => TenantConfig): Promise<Tenant> {
    const tenant = await this.prisma.forTenant(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tenant WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const current = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      const currentConfig = (current.configJson ?? {}) as TenantConfig;
      const nextConfig = mutate(currentConfig);
      return tx.tenant.update({
        where: { id: tenantId },
        data: { configJson: nextConfig as Prisma.InputJsonValue },
      });
    });

    const serialized = serializeTenant(tenant);
    await this.revalidation.revalidateTenant(serialized);
    return serialized;
  }

  private validatePlainCopy(value: unknown, field: string, maxLength: number): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw new BadRequestException(`${field} must be a string`);
    }
    const trimmed = value.trim();
    if (trimmed === "") {
      return undefined;
    }
    if (trimmed.length > maxLength) {
      throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
    }
    return trimmed;
  }

  private validateColors(colors: unknown): void {
    if (!colors || typeof colors !== "object" || Array.isArray(colors)) {
      throw new BadRequestException("colors must be an object");
    }

    const invalid = Object.entries(colors as Record<string, unknown>)
      .filter(([, value]) => value !== undefined)
      .filter(([, value]) => !isValidColor(value))
      .map(([field]) => field);

    if (invalid.length > 0) {
      throw new BadRequestException(invalid.map((field) => `${field} must be a valid hex or rgb color`));
    }
  }
}
