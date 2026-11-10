import { useI18n } from "../i18n/I18nContext.js";

/**
 * Holds the viewport while a lazily-loaded route chunk arrives.
 *
 * Every page renders its own `AppShell`, so a route chunk that isn't there yet
 * takes the sidebar down with it — this stands in for the entire screen, not
 * just the content area. It stays deliberately plain: a fake shell would be a
 * second copy of the layout to keep in sync, for something that (thanks to the
 * prefetch in App.tsx) is rarely on screen at all.
 */
export function RouteFallback() {
  const { t } = useI18n();

  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-base-content/60">
        <span className="loading loading-spinner loading-md text-primary" aria-hidden="true" />
        <span className="text-sm">{t("common.loading")}</span>
      </div>
    </div>
  );
}
