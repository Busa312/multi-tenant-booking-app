import type { TenantUserRole } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { Button, ButtonLink, Card, Eyebrow } from "./ui/index.js";
import styles from "./DashboardQuickActions.module.css";

/** Why "New booking" can't be used yet — the brand-new-tenant states. */
export type BookingBlocker = "no-services" | "no-professionals";

interface DashboardQuickActionsProps {
  role: TenantUserRole | null;
  onNewBooking: () => void;
  /** False while the rosters are still loading, empty, or the login can't book. */
  canBook: boolean;
  blocker: BookingBlocker | null;
}

/**
 * The four things staff most often arrive here to do. Everything but "new
 * booking" navigates to the page that already owns that flow rather than
 * duplicating its modal, and all three of those routes are owner-gated in
 * App.tsx — so the buttons a professional can see match the routes they can
 * reach.
 */
export function DashboardQuickActions({ role, onNewBooking, canBook, blocker }: DashboardQuickActionsProps) {
  const { t } = useI18n();

  return (
    <Card className={styles.card}>
      <Eyebrow>{t("dashboard.quickActions")}</Eyebrow>
      <div className={styles.row}>
        <Button icon="add" disabled={!canBook} onClick={onNewBooking}>
          {t("dashboard.actionNewBooking")}
        </Button>

        {role === "owner" && (
          <>
            <ButtonLink to="/services" variant="secondary" icon="design_services">
              {t("dashboard.actionAddService")}
            </ButtonLink>
            <ButtonLink to="/professionals" variant="secondary" icon="person_add">
              {t("dashboard.actionInvitePro")}
            </ButtonLink>
            <ButtonLink to="/hours" variant="secondary" icon="schedule">
              {t("dashboard.actionEditHours")}
            </ButtonLink>
          </>
        )}
      </div>

      {/* One next step, not two: a tenant with neither services nor staff is
          pointed at the service first. */}
      {blocker && (
        <p className={styles.hint}>
          {t(blocker === "no-services" ? "dashboard.noServicesYet" : "dashboard.noProfessionalsYet")}
        </p>
      )}
    </Card>
  );
}
