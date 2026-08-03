import { useI18n } from "../i18n/I18nContext.js";
import styles from "./RouteFallback.module.css";

/**
 * Holds the viewport while a lazily-loaded route chunk arrives.
 *
 * Every page renders its own `AppShell`, so a route chunk that isn't there yet
 * takes the sidebar down with it — this is what stands in for the entire
 * screen, not just the content area. It stays deliberately plain: dressing it
 * up as a fake shell would mean maintaining a second copy of the layout that
 * drifts from the real one, for something that (thanks to the prefetch in
 * App.tsx) is rarely on screen at all.
 */
export function RouteFallback() {
  const { t } = useI18n();

  return (
    <div className={styles.root} role="status" aria-live="polite">
      <span className={styles.label}>{t("common.loading")}</span>
    </div>
  );
}
