import { NotFoundMessage } from "@/components/NotFoundMessage";
import { DEFAULT_LOCALE, DEFAULT_LOCALE_SEGMENT, getMessages, translator } from "@/i18n/locales";
import { loadPageContextOrNull } from "@/lib/page-context";

/**
 * Catches notFound() from the pages, inside the salon's layout. Without it
 * the default boundary sits above the root layout and replaces it with a
 * blank page. Next passes a not-found page no params, so it speaks the
 * salon's main language (R160) — or the platform's, for a host no salon owns.
 */
export default async function NotFound() {
  const context = await loadPageContextOrNull(DEFAULT_LOCALE_SEGMENT);
  return <NotFoundMessage t={context?.t ?? translator(getMessages(DEFAULT_LOCALE))} />;
}
