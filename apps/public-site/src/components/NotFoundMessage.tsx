import type { Translate } from "@/i18n/locales";

interface NotFoundMessageProps {
  t: Translate;
}

/** The body of every 404 the site answers: a mistyped salon address or a missing page. */
export function NotFoundMessage({ t }: NotFoundMessageProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <p className="text-7xl leading-none font-semibold tracking-tight text-base-content/30 tabular-nums">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">{t("notFound.title")}</h1>
      <p className="text-base-content/65">{t("notFound.body")}</p>
    </div>
  );
}
