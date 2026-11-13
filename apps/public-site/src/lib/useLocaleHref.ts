"use client";

import { usePathname } from "next/navigation";
import { isLocale } from "@/i18n/locales";

/**
 * R160, for client components: turns a site path ("/book") into a link that
 * stays in the language the visitor is reading. The language is read off the
 * URL they are on — a prefix means that language, none means the salon's main
 * one — so no prop has to carry it down.
 */
export function useLocaleHref(): (path: string) => string {
  const first = (usePathname() ?? "").split("/")[1] ?? "";
  const prefix = isLocale(first) ? `/${first}` : "";
  return (path) => (prefix === "" ? path : `${prefix}${path === "/" ? "" : path}`);
}
