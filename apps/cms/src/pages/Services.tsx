import { useEffect, useState } from "react";
import type { ProfessionalSummary, ServiceCategory, ServiceSummary } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { enabledLocalesOf } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { ConfirmModal, type ConfirmRequest } from "../components/ConfirmModal.js";
import { groupServices, moved, type ServiceGroup } from "../lib/serviceGroups.js";
import { AppShell } from "../components/AppShell.js";
import { Modal } from "../components/Modal.js";
import { EditServiceModal } from "../components/EditServiceModal.js";
import { EditCategoryModal } from "../components/EditCategoryModal.js";
import { ServiceCategorySection } from "../components/ServiceCategorySection.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { type ActionMenuItem, Alert, Button } from "../components/ui/index.js";

/** A TableRow with an ActionMenu in it. Sized for the loading placeholder. */
const TABLE_ROW = "46px";

interface PageData {
  services: ServiceSummary[];
  // R510: the headings, in the salon's order
  categories: ServiceCategory[];
  professionals: ProfessionalSummary[];
  // R50: a service with nobody assigned is only reachable if the tenant has
  // tenant-wide (professionalId === null) business hours — which changes what
  // the unbookable warning tells the owner to do about it.
  hasTenantWideHours: boolean;
  enabledLocales: string[];
}

export function ServicesPage() {
  const { t } = useI18n();
  // The question waiting on an answer, if any (see ConfirmModal).
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const nameOf = useLocalizedName();
  const [data, setData] = useState<PageData | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ServiceSummary | "new" | null>(null);
  // R510: the category a new service starts in (the section its "Add" was pressed in)
  const [newServiceCategory, setNewServiceCategory] = useState<string | null>(null);
  const [categoryTarget, setCategoryTarget] = useState<ServiceCategory | "new" | null>(null);
  // A reorder is on its way: the arrows wait for it rather than racing it.
  const [reordering, setReordering] = useState(false);
  const [unbookableWarning, setUnbookableWarning] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ServiceSummary | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  function load() {
    return Promise.all([
      cachedApi.listServices(),
      cachedApi.listProfessionals(),
      cachedApi.listBusinessHours(),
      cachedApi.getTenant(),
      cachedApi.listServiceCategories(),
    ])
      .then(([services, professionals, hours, tenant, categories]) => {
        setData({
          services,
          categories,
          professionals,
          hasTenantWideHours: hours.some((h) => h.professionalId === null),
          enabledLocales: enabledLocalesOf(tenant.configJson.enabledLocales),
        });
      })
      .catch(() => setListError(t("services.errLoad")));
  }

  // Fetch once on mount; a language switch shouldn't trigger a refetch.
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function addService(categoryId: string | null) {
    setNewServiceCategory(categoryId);
    setEditTarget("new");
  }

  /** R510: one place up or down in its category. */
  async function moveService(group: ServiceGroup<ServiceSummary>, index: number, direction: -1 | 1) {
    setListError(null);
    setReordering(true);
    try {
      await cachedApi.reorderServices({
        categoryId: group.category?.id ?? null,
        ids: moved(group.services.map((service) => service.id), index, direction),
      });
      await load();
    } catch {
      setListError(t("services.errReorder"));
    } finally {
      setReordering(false);
    }
  }

  /** R510: one place up or down among the categories. */
  async function moveCategory(index: number, direction: -1 | 1) {
    if (!data) return;
    setListError(null);
    setReordering(true);
    try {
      await cachedApi.reorderServiceCategories({ ids: moved(data.categories.map((category) => category.id), index, direction) });
      await load();
    } catch {
      setListError(t("services.errReorder"));
    } finally {
      setReordering(false);
    }
  }

  function deleteCategory(category: ServiceCategory, serviceCount: number) {
    const name = nameOf(category.name, category.nameI18n);
    setConfirmRequest({
      title: t("services.deleteCategory"),
      message: t("services.confirmDeleteCategory", { name, count: serviceCount }),
      confirmLabel: t("services.deleteCategory"),
      danger: true,
      run: () =>
        void cachedApi
          .deleteServiceCategory(category.id)
          .then(load)
          .catch(() => setListError(t("services.errCategorySave"))),
    });
  }

  // Empty categories stay visible here, so they can be filled.
  const groups = data ? groupServices(data.services, data.categories, { keepEmpty: true }) : [];

  return (
    <AppShell title={t("services.title")} subtitle={t("services.subtitle")}>
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
          {/* Disabled until the roster and locale list are in — the form can't
              be rendered without them. */}
          {/* R510 */}
          <Button className="ml-auto" variant="secondary" icon="add" disabled={!data} onClick={() => setCategoryTarget("new")}>
            {t("services.addCategory")}
          </Button>
          <Button icon="add" disabled={!data} onClick={() => addService(null)}>
            {t("services.add")}
          </Button>
        </div>

        {listError && <Alert>{listError}</Alert>}
        {unbookableWarning && <Alert variant="warning">{unbookableWarning}</Alert>}

        {/* R510: the price list under its categories, in the salon's order */}
        {data &&
          groups.map((group) => {
            const index = group.category ? data.categories.indexOf(group.category) : -1;
            const category = group.category;
            return (
              <ServiceCategorySection
                key={category?.id ?? "uncategorized"}
                title={category ? nameOf(category.name, category.nameI18n) : t(data.categories.length > 0 ? "services.uncategorized" : "services.allServices")}
                services={group.services}
                categoryActions={
                  category
                    ? [
                        { label: t("services.renameCategory"), icon: "edit", onSelect: () => setCategoryTarget(category) },
                        {
                          label: t("services.deleteCategory"),
                          icon: "delete",
                          danger: true,
                          onSelect: () => deleteCategory(category, group.services.length),
                        },
                      ]
                    : undefined
                }
                onMoveUp={category && index > 0 ? () => void moveCategory(index, -1) : undefined}
                onMoveDown={category && index < data.categories.length - 1 ? () => void moveCategory(index, 1) : undefined}
                onAddService={() => addService(category?.id ?? null)}
                professionalNames={professionalNames}
                serviceActions={rowActions}
                onMoveService={(serviceIndex, direction) => void moveService(group, serviceIndex, direction)}
                busy={reordering}
              />
            );
          })}
        {!data && <CardSkeleton rows={5} rowHeight={TABLE_ROW} />}
      </div>

      {editTarget && data && (
        <EditServiceModal
          target={editTarget}
          professionals={data.professionals}
          locales={data.enabledLocales}
          categories={data.categories}
          defaultCategoryId={newServiceCategory}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {categoryTarget && data && (
        <EditCategoryModal
          target={categoryTarget}
          locales={data.enabledLocales}
          onClose={() => setCategoryTarget(null)}
          onSaved={() => {
            setCategoryTarget(null);
            void load();
          }}
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
