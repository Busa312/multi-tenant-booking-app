import { DEFAULT_CONTENT_LOCALE, localized, type LocalizedText } from "./i18n";

/** R550: what names a plan — English in `name`, Georgian and Russian in `nameI18n`. */
export interface PlanName {
  name: string;
  nameI18n: LocalizedText | null;
}

/**
 * R550: a plan's name in `locale` ("en" | "ka" | "ru"). The platform admin names
 * plans in English first, so a missing translation shows the English name —
 * whatever a salon's own default language is.
 */
export function planName(plan: PlanName, locale: string): string {
  return localized(plan.name, plan.nameI18n, locale, DEFAULT_CONTENT_LOCALE);
}
