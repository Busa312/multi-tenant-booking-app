import { useI18n } from "../i18n/I18nContext.js";
import type { TodaysAgenda } from "../lib/dashboardStats.js";
import { AgendaList } from "./AgendaList.js";
import { AgendaNextUp } from "./AgendaNextUp.js";
import { ButtonLink, Card, Eyebrow } from "./ui/index.js";

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
    <Card>
      <div className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0">
          <Eyebrow>{t("dashboard.agendaTitle")}</Eyebrow>
          <div className="mt-0.5 font-display text-lg font-semibold">{t("dashboard.agendaCount", { count: heldCount })}</div>
        </div>
        <ButtonLink to="/bookings" variant="secondary" size="sm" className="ml-auto flex-none">
          {t("dashboard.agendaOpenCalendar")}
        </ButtonLink>
      </div>

      {all.length === 0 ? (
        <p className="py-6 text-center text-base-content/60">{t(isOwnOnly ? "dashboard.agendaEmptyOwn" : "dashboard.agendaEmpty")}</p>
      ) : (
        <>
          {nextUp ? (
            <AgendaNextUp appointment={nextUp} timezone={timezone} />
          ) : (
            // The day's bookings are all behind us — say so rather than
            // highlighting something already finished as "next up".
            <p className="mb-4 rounded-field bg-base-200/60 px-4 py-3 text-base-content/60">{t("dashboard.agendaNothingLeft")}</p>
          )}

          {rest.length > 0 && (
            <>
              {nextUp && <Eyebrow className="mb-1">{t("dashboard.agendaRest")}</Eyebrow>}
              <AgendaList appointments={rest} timezone={timezone} />
            </>
          )}
        </>
      )}
    </Card>
  );
}
