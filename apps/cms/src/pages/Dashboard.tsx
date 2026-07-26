import { useEffect, useState } from "react";
import type { Tenant } from "@booking/shared-types";
import { cmsApiClient } from "../lib/api.js";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { AppShell } from "../components/AppShell.js";
import { ButtonLink, Card, Eyebrow, Icon } from "../components/ui/index.js";
import styles from "./Dashboard.module.css";

export function DashboardPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const { role } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    cmsApiClient.getTenant().then(setTenant);
  }, []);

  return (
    <AppShell
      title={tenant ? t("dashboard.welcome") : t("common.loading")}
      subtitle={tenant ? tenant.name : undefined}
      tenantSubdomain={tenant?.subdomain}
    >
      <div className="fade-up">
        <Card className={styles.card}>
          <Eyebrow>{t("dashboard.eyebrow")}</Eyebrow>
          <p className={styles.intro}>{t("dashboard.intro")}</p>
          {role === "owner" && (
            <ButtonLink to="/settings/colors" variant="secondary" className={styles.cta}>
              <Icon name="palette" size={19} color="var(--accent)" />
              {t("dashboard.editColors")}
            </ButtonLink>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
