// R160: where a page lives for a given language. Pure, so the server (page
// context, sitemap) and the browser (useLocaleHref, the language switcher)
// build the same URLs.

/** Request header the middleware sets: the path and query without any language prefix. */
export const SITE_PATH_HEADER = "x-site-path";

/**
 * The URL path of `path` in `locale`: the salon's main language has no prefix,
 * every other one is prefixed (`/ka/book`).
 */
export function localePath(locale: string, defaultLocale: string, path: string): string {
  if (locale === defaultLocale) {
    return path;
  }
  return `/${locale}${path === "/" ? "" : path}`;
}
