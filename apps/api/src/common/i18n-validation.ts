import { BadRequestException } from "@nestjs/common";
import type { LocalizedText } from "@booking/shared-types";
import { Prisma } from "../../generated/prisma/index.js";

// R160: validation and normalisation for the `*_i18n` JSONB columns

export const LOCALIZED_NAME_MAX = 200;

/**
 * Every locale the platform can publish in, and the set a tenant gets until an
 * owner narrows it. Mirrors SUPPORTED_CONTENT_LOCALES in @booking/shared-types
 * for the reason this whole file is duplicated: apps/api cannot import runtime
 * values from that package.
 */
export const SUPPORTED_CONTENT_LOCALES = ["en", "ka"];
export const LOCALIZED_TEXT_MAX = 2000;

export function validateLocalizedText(
  value: unknown,
  field: string,
  enabledLocales: string[],
  maxLength: number = LOCALIZED_NAME_MAX,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) {
    return Prisma.DbNull;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an object keyed by locale`);
  }

  const defaultLocale = enabledLocales[0];
  const pruned: LocalizedText = {};

  for (const [locale, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "string") {
      throw new BadRequestException(`${field}.${locale} must be a string`);
    }
    const trimmed = entry.trim();
    if (trimmed === "" || locale === defaultLocale) {
      continue;
    }

    if (!enabledLocales.includes(locale)) {
      throw new BadRequestException(`${field}.${locale} is not one of this tenant's enabled locales`);
    }
    if (trimmed.length > maxLength) {
      throw new BadRequestException(`${field}.${locale} must be at most ${maxLength} characters`);
    }
    pruned[locale] = trimmed;
  }

  return Object.keys(pruned).length > 0 ? pruned : Prisma.DbNull;
}

export function enabledLocalesOf(configJson: unknown): string[] {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return SUPPORTED_CONTENT_LOCALES;
  }
  const locales = (configJson as { enabledLocales?: unknown }).enabledLocales;
  if (!Array.isArray(locales)) {
    return SUPPORTED_CONTENT_LOCALES;
  }
  const valid = locales.filter(
    (locale): locale is string => typeof locale === "string" && SUPPORTED_CONTENT_LOCALES.includes(locale),
  );
  return valid.length > 0 ? valid : SUPPORTED_CONTENT_LOCALES;
}
