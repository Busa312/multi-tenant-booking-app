import { useI18n } from "../i18n/I18nContext.js";
import type { TodaysAgenda } from "../lib/dashboardStats.js";
import { AgendaList } from "./AgendaList.js";
import { AgendaNextUp } from "./AgendaNextUp.js";
import { ButtonLink, Card, Eyebrow } from "./ui/index.js";
import styles from "./TodayAgendaCard.module.css";

interface TodayAgendaCardProps {
  agenda: TodaysAgenda;
  timezone: string;
  /** True for a `professional` login: the empty state is about them, not the salon. */
  isOwnOnly: boolean;
}

/** Today's book: what's next, then everything else on it. */
export function TodayAgendaCard({ agenda, timezone, isOwnOnly }: TodayAgendaCardProps) {
  const { t } = useI18n();
  const { all, nextUp, rest, heldCount } = agenda;

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <Eyebrow>{t("dashboard.agendaTitle")}</Eyebrow>
          <div className={styles.count}>{t("dashboard.agendaCount", { count: heldCount })}</div>
        </div>
        <ButtonLink to="/bookings" variant="secondary" size="sm" className={styles.open}>
          {t("dashboard.agendaOpenCalendar")}
        </ButtonLink>
      </div>

      {all.length === 0 ? (
        <p className={styles.empty}>{t(isOwnOnly ? "dashboard.agendaEmptyOwn" : "dashboard.agendaEmpty")}</p>
      ) : (
        <>
          {nextUp ? (
            <AgendaNextUp appointment={nextUp} timezone={timezone} />
          ) : (
            // The day's bookings are all behind us — say so rather than
            // highlighting something already finished as "next up".
            <p className={styles.done}>{t("dashboard.agendaNothingLeft")}</p>
          )}

          {rest.length > 0 && (
            <>
              {nextUp && <Eyebrow className={styles.restLabel}>{t("dashboard.agendaRest")}</Eyebrow>}
              <AgendaList appointments={rest} timezone={timezone} />
            </>
          )}
        </>
      )}
    </Card>
  );
}
