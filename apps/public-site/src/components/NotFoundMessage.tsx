import type { Translate } from "@/i18n/locales";

interface NotFoundMessageProps {
  t: Translate;
}

/** The body of every 404 the site answers: a mistyped salon address or a missing page. */
export function NotFoundMessage({ t }: NotFoundMessageProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <p className="text-7xl leading-none font-extrabold tracking-tight tabular-nums">404</p>
      <h1 className="text-2xl font-extrabold tracking-tight">{t("notFound.title")}</h1>
      <p className="text-base-content/65">{t("notFound.body")}</p>
    </div>
  );
}
