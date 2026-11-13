import type { TenantUserRole } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { Button, ButtonLink } from "./ui/index.js";

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
 * The dashboard's one action: take a booking. Everything else staff might do
 * from here is a sidebar link, so it isn't repeated. When a brand-new salon
 * can't take bookings yet, this says why and — for the owner, who can reach
 * those pages — offers the one step that unblocks it.
 */
export function DashboardQuickActions({ role, onNewBooking, canBook, blocker }: DashboardQuickActionsProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 [&>*]:pointer-coarse:min-h-11">
      {/* One next step, not two: a tenant with neither services nor staff is
          pointed at the service first. */}
      {blocker && (
        <p className="text-sm text-base-content/70">
          {t(blocker === "no-services" ? "dashboard.noServicesYet" : "dashboard.noProfessionalsYet")}
        </p>
      )}
      {blocker && role === "owner" && (
        <ButtonLink
          to={blocker === "no-services" ? "/services" : "/professionals"}
          variant="secondary"
          icon={blocker === "no-services" ? "design_services" : "person_add"}
        >
          {t(blocker === "no-services" ? "dashboard.actionAddService" : "dashboard.actionInvitePro")}
        </ButtonLink>
      )}
      <Button icon="add" disabled={!canBook} onClick={onNewBooking}>
        {t("dashboard.actionNewBooking")}
      </Button>
    </div>
  );
}
