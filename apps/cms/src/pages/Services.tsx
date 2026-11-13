import { useEffect, useState } from "react";
import type { ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { ConfirmModal, type ConfirmRequest } from "../components/ConfirmModal.js";
import { usePagination } from "../lib/usePagination.js";
import { AppShell } from "../components/AppShell.js";
import { PillList } from "../components/PillList.js";
import { Modal } from "../components/Modal.js";
import { EditServiceModal } from "../components/EditServiceModal.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import {
  ActionMenu,
  type ActionMenuItem,
  Alert,
  Button,
  Pill,
  Pagination, Table,
  TableHead,
  TableRow,
  TableEmpty,
} from "../components/ui/index.js";

const COLUMNS = "1.3fr 90px 100px 1.4fr 100px 60px";

// A service many people perform would otherwise grow its row a line per few
// names; past this many the rest fold into a "+N" chip that lists them.
const MAX_PROFESSIONAL_CHIPS = 2;

/** A TableRow with an ActionMenu in it. Sized for the loading placeholder. */
const TABLE_ROW = "46px";

interface PageData {
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
  // R50: a service with nobody assigned is only reachable if the tenant has
  // tenant-wide (professionalId === null) business hours — which changes what
  // the unbookable warning tells the owner to do about it.
  hasTenantWideHours: boolean;
  enabledLocales: string[];
}

// Rows per page; a pager appears only once there are more.
const PAGE_SIZE = 10;

export function ServicesPage() {
  const { t } = useI18n();
  // The question waiting on an answer, if any (see ConfirmModal).
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const nameOf = useLocalizedName();
  const [data, setData] = useState<PageData | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ServiceSummary | "new" | null>(null);
  const [unbookableWarning, setUnbookableWarning] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ServiceSummary | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  function load() {
    Promise.all([
      cachedApi.listServices(),
      cachedApi.listProfessionals(),
      cachedApi.listBusinessHours(),
      cachedApi.getTenant(),
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
      .map((id) => data.professionals.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => nameOf(p.name, p.nameI18n));
  }

  function handleSaved(saved: ServiceSummary) {
    setEditTarget(null);
    // R50: created/updated with nobody assigned — surface it rather than
    // silently publishing a service that yields no bookable slots.
    setUnbookableWarning(
      saved.professionalIds.length === 0
        ? t(data?.hasTenantWideHours ? "services.unbookableWarningTenantHours" : "services.unbookableWarning", {
            name: nameOf(saved.name, saved.nameI18n),
          })
        : null,
    );
    load();
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);
    try {
      await cachedApi.updateService(deactivateTarget.id, { isActive: false });
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
      await cachedApi.updateService(s.id, { isActive: true });
      load();
    } catch {
      setListError(t("services.errReactivate"));
    }
  }

  function handleDelete(s: ServiceSummary) {
    setConfirmRequest({
      title: t("services.delete"),
      message: t("services.confirmDelete", { name: nameOf(s.name, s.nameI18n) }),
      confirmLabel: t("services.delete"),
      danger: true,
      run: () => void handleDeleteConfirmed(s),
    });
  }

  async function handleDeleteConfirmed(s: ServiceSummary) {
    setListError(null);
    try {
      await cachedApi.deleteService(s.id);
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
        : ([{ label: t("services.delete"), icon: "delete", danger: true, onSelect: () => handleDelete(s) }] satisfies ActionMenuItem[])),
    ];
  }

  const pager = usePagination(data?.services ?? [], PAGE_SIZE);

  return (
    <AppShell title={t("services.title")} subtitle={t("services.subtitle")}>
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
          {/* Disabled until the roster and locale list are in — the form can't
              be rendered without them. */}
          <Button className="ml-auto" icon="add" disabled={!data} onClick={() => setEditTarget("new")}>
            {t("services.add")}
          </Button>
        </div>

        {listError && <Alert>{listError}</Alert>}
        {unbookableWarning && <Alert variant="warning">{unbookableWarning}</Alert>}

        {data && (
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHead columns={COLUMNS}>
                <div>{t("services.colName")}</div>
                <div>{t("services.colDuration")}</div>
                <div>{t("services.colPrice")}</div>
                <div>{t("services.colProfessionals")}</div>
                <div>{t("services.colStatus")}</div>
                <div></div>
              </TableHead>
              {pager.pageItems.map((s) => (
                <TableRow key={s.id} columns={COLUMNS}>
                  <div>
                    <div className="font-semibold">{nameOf(s.name, s.nameI18n)}</div>
                    {s.description && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-base-content/60">
                        {nameOf(s.description, s.descriptionI18n)}
                      </div>
                    )}
                  </div>
                  <div className="text-[13.5px] tabular-nums">{t("services.minutes", { count: s.durationMinutes })}</div>
                  <div className="text-[13.5px] font-medium tabular-nums">{t("services.priceValue", { price: s.price })}</div>
                  <div className="flex flex-wrap gap-1">
                    <PillList items={professionalNames(s)} max={MAX_PROFESSIONAL_CHIPS} />
                    {s.professionalIds.length === 0 && <Pill tone="warning">{t("services.noneAssigned")}</Pill>}
                  </div>
                  <div>
                    <Pill tone={s.isActive ? "success" : "danger"}>
                      {t(s.isActive ? "services.active" : "services.inactive")}
                    </Pill>
                  </div>
                  <div className="flex justify-end">
                    <ActionMenu ariaLabel={t("common.rowActions", { name: nameOf(s.name, s.nameI18n) })} items={rowActions(s)} />
                  </div>
                </TableRow>
              ))}
              {data.services.length === 0 && <TableEmpty>{t("services.empty")}</TableEmpty>}
            </Table>
            <Pagination {...pager} />
          </div>
        )}
        {!data && <CardSkeleton rows={5} rowHeight={TABLE_ROW} />}
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
          <p className="text-base-content/70">{t("services.deactivateBody", { name: nameOf(deactivateTarget.name, deactivateTarget.nameI18n) })}</p>
        </Modal>
      )}
      {confirmRequest && <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />}
    </AppShell>
  );
}
