import type { Translate } from "@/i18n/locales";

interface NotFoundMessageProps {
  t: Translate;
}

/** The body of every 404 the site answers: a mistyped salon address or a missing page. */
export function NotFoundMessage({ t }: NotFoundMessageProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-5xl font-bold tracking-tight text-base-content/40">404</p>
      <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
      <p className="text-base-content/60">{t("notFound.body")}</p>
    </div>
  );
}
