import { useI18n } from "../i18n/I18nContext.js";
import { Button, Card } from "./ui/index.js";
import styles from "./ErrorScreen.module.css";

/**
 * `stale` — a route chunk failed to load, essentially always because a deploy
 * replaced the hashed filename this tab still points at. Reloading is a real
 * fix, so it leads.
 *
 * `crash` — anything else that threw during render. Reloading might clear it
 * and might not, so it is offered quietly rather than promised.
 */
export type ErrorKind = "stale" | "crash";

interface ErrorScreenProps {
  kind: ErrorKind;
  onReload: () => void;
}

/**
 * The whole-page failure state. Split out of `ErrorBoundary` because that has
 * to be a class (React has no hook for `getDerivedStateFromError`) and so
 * cannot call `useI18n` — this half stays an ordinary function component and
 * owns everything visible.
 *
 * It renders outside `AppShell`: the shell lives inside the subtree that just
 * failed, so this has to stand on its own page.
 */
export function ErrorScreen({ kind, onReload }: ErrorScreenProps) {
  const { t } = useI18n();
  const stale = kind === "stale";

  return (
    <div className={styles.root}>
      <Card className={styles.card} role="alert">
        <h1 className={styles.title}>{t(stale ? "error.staleTitle" : "error.crashTitle")}</h1>
        <p className={styles.body}>{t(stale ? "error.staleBody" : "error.crashBody")}</p>
        <Button variant={stale ? "primary" : "secondary"} icon="refresh" onClick={onReload}>
          {t("error.reload")}
        </Button>
      </Card>
    </div>
  );
}
