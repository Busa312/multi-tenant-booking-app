import { useEffect, useState } from "react";
import type { ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { cmsApiClient } from "../lib/api.js";
import { useI18n } from "../i18n/I18nContext.js";
import { AppShell } from "../components/AppShell.js";
import { Modal } from "../components/Modal.js";
import { EditServiceModal } from "../components/EditServiceModal.js";
import {
  ActionMenu,
  type ActionMenuItem,
  Alert,
  Button,
  Pill,
  Table,
  TableHead,
  TableRow,
  TableEmpty,
} from "../components/ui/index.js";
import styles from "./Services.module.css";

const COLUMNS = "1.3fr 90px 100px 1.4fr 100px 60px";

interface PageData {
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
  // R50: a service with nobody assigned is only reachable if the tenant has
  // tenant-wide (professionalId === null) business hours — which changes what
  // the unbookable warning tells the owner to do about it.
  hasTenantWideHours: boolean;
  enabledLocales: string[];
}

export function ServicesPage() {
  const { t } = useI18n();
  const [data, setData] = useState<PageData | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ServiceSummary | "new" | null>(null);
  const [unbookableWarning, setUnbookableWarning] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ServiceSummary | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  function load() {
    Promise.all([
      cmsApiClient.listServices(),
      cmsApiClient.listProfessionals(),
      cmsApiClient.listBusinessHours(),
      cmsApiClient.getTenant(),
    ])
      .then(([services, professionals, hours, tenant]) => {
        setData({
          services,
          professionals,
          hasTenantWideHours: hours.some((h) => h.professionalId === null),
          enabledLocales: tenant.configJson.enabledLocales ?? [],
        });
      })
      .catch(() => setListError(t("services.errLoad")));
  }

  // Fetch once on mount; a language switch shouldn't trigger a refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  function professionalNames(s: ServiceSummary): string[] {
    if (!data) return [];
    return s.professionalIds
      .map((id) => data.professionals.find((p) => p.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  }

  function handleSaved(saved: ServiceSummary) {
    setEditTarget(null);
    // R50: created/updated with nobody assigned — surface it rather than
    // silently publishing a service that yields no bookable slots.
    setUnbookableWarning(
      saved.professionalIds.length === 0
        ? t(data?.hasTenantWideHours ? "services.unbookableWarningTenantHours" : "services.unbookableWarning", {
            name: saved.name,
          })
        : null,
    );
    load();
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);
    try {
      await cmsApiClient.updateService(deactivateTarget.id, { isActive: false });
      setDeactivateTarget(null);
      load();
    } catch {
      setListError(t("services.errDeactivate"));
    } finally {
      setDeactivateLoading(false);
    }
  }

  async function handleReactivate(s: ServiceSummary) {
    setListError(null);
    try {
      await cmsApiClient.updateService(s.id, { isActive: true });
      load();
    } catch {
      setListError(t("services.errReactivate"));
    }
  }

  async function handleDelete(s: ServiceSummary) {
    if (!window.confirm(t("services.confirmDelete", { name: s.name }))) return;
    setListError(null);
    try {
      await cmsApiClient.deleteService(s.id);
      load();
    } catch (err) {
      setListError(t(err instanceof ApiError ? "services.errHasHistory" : "common.somethingWrong"));
    }
  }

  function rowActions(s: ServiceSummary): ActionMenuItem[] {
    return [
      { label: t("services.edit"), icon: "edit", onSelect: () => setEditTarget(s) },
      s.isActive
        ? { label: t("services.deactivate"), icon: "visibility_off", onSelect: () => setDeactivateTarget(s) }
        : { label: t("services.reactivate"), icon: "visibility", onSelect: () => handleReactivate(s) },
      // R70: delete is only offered for a service that was never booked.
      ...(s.hasAppointmentHistory
        ? []
        : [{ label: t("services.delete"), icon: "delete", danger: true, onSelect: () => handleDelete(s) }]),
    ];
  }

  return (
    <AppShell title={t("services.title")} subtitle={t("services.subtitle")}>
      <div className="fade-up">
        <div className={styles.toolbar}>
          <div className={styles.count}>
            {data ? t("services.count", { count: data.services.length }) : t("common.loading")}
          </div>
          {/* Disabled until the roster and locale list are in — the form can't
              be rendered without them. */}
          <Button className={styles.add} icon="add" disabled={!data} onClick={() => setEditTarget("new")}>
            {t("services.add")}
          </Button>
        </div>

        {listError && <Alert>{listError}</Alert>}
        {unbookableWarning && <Alert variant="warning">{unbookableWarning}</Alert>}

        {data && (
          <div className={styles.tableScroll}>
            <Table className={styles.table}>
              <TableHead columns={COLUMNS}>
                <div>{t("services.colName")}</div>
                <div>{t("services.colDuration")}</div>
                <div>{t("services.colPrice")}</div>
                <div>{t("services.colProfessionals")}</div>
                <div>{t("services.colStatus")}</div>
                <div></div>
              </TableHead>
              {data.services.map((s) => (
                <TableRow key={s.id} columns={COLUMNS}>
                  <div>
                    <div className={styles.name}>{s.name}</div>
                    {s.description && <div className={styles.description}>{s.description}</div>}
                  </div>
                  <div className={styles.cell}>{t("services.minutes", { count: s.durationMinutes })}</div>
                  <div className={styles.cell}>{t("services.priceValue", { price: s.price })}</div>
                  <div className={styles.badges}>
                    {professionalNames(s).map((name) => (
                      <Pill key={name}>{name}</Pill>
                    ))}
                    {s.professionalIds.length === 0 && <Pill tone="warning">{t("services.noneAssigned")}</Pill>}
                  </div>
                  <div>
                    <Pill tone={s.isActive ? "success" : "danger"}>
                      {t(s.isActive ? "services.active" : "services.inactive")}
                    </Pill>
                  </div>
                  <div className={styles.actions}>
                    <ActionMenu ariaLabel={t("common.rowActions", { name: s.name })} items={rowActions(s)} />
                  </div>
                </TableRow>
              ))}
              {data.services.length === 0 && <TableEmpty>{t("services.empty")}</TableEmpty>}
            </Table>
          </div>
        )}
      </div>

      {editTarget && data && (
        <EditServiceModal
          target={editTarget}
          professionals={data.professionals}
          locales={data.enabledLocales}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {deactivateTarget && (
        <Modal
          title={t("services.deactivateTitle")}
          onClose={() => setDeactivateTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeactivateTarget(null)} disabled={deactivateLoading}>
                {t("common.cancel")}
              </Button>
              <Button onClick={confirmDeactivate} disabled={deactivateLoading}>
                {deactivateLoading ? t("services.deactivating") : t("services.deactivate")}
              </Button>
            </>
          }
        >
          {/* R60: existing appointments for this service are untouched — only
              the public listing and new bookings change. */}
          <p className={styles.muted}>{t("services.deactivateBody", { name: deactivateTarget.name })}</p>
        </Modal>
      )}
    </AppShell>
  );
}
