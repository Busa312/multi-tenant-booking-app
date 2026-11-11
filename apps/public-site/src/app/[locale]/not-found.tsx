import { cookies } from "next/headers";
import { NotFoundMessage } from "@/components/NotFoundMessage";
import { DEFAULT_LOCALE, LOCALE_COOKIE, getMessages, isLocale, translator } from "@/i18n/locales";

/**
 * Catches notFound() from the pages, inside the salon's layout. Without it
 * the default boundary sits above the root layout and replaces it with a
 * blank page. Next passes a not-found page no params, so the language comes
 * from the R160 cookie.
 */
export default function NotFound() {
  const cookie = cookies().get(LOCALE_COOKIE)?.value;
  return <NotFoundMessage t={translator(getMessages(isLocale(cookie) ? cookie : DEFAULT_LOCALE))} />;
}
