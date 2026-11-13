import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE_SEGMENT, isLocale } from "@/i18n/locales";
import { SITE_PATH_HEADER } from "@/lib/locale-path";

/**
 * R160: the URL decides the language. `/ka/book` is Georgian; a path with no
 * language in front (`/book`) is the salon's main language, whichever that is.
 * Nothing else is consulted — no cookie, no Accept-Language — so one URL
 * always shows one language, which is what lets search engines index both.
 *
 * Which language is a salon's main one is only known once its settings are
 * loaded, so an unprefixed path is rewritten to the `_` placeholder segment
 * and the page resolves it (lib/page-context.ts). Every request also carries
 * the path *without* its language prefix, for building links, canonical URLs
 * and redirects on the server.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  const headers = new Headers(request.headers);

  if (isLocale(first)) {
    headers.set(SITE_PATH_HEADER, (pathname.slice(first.length + 1) || "/") + search);
    return NextResponse.next({ request: { headers } });
  }

  headers.set(SITE_PATH_HEADER, pathname + search);
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE_SEGMENT}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  // Not the API routes, Next's own assets, or anything with a file extension
  // (robots.txt, sitemap.xml, the icon).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
