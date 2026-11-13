import { useEffect, useState } from "react";
import type {
  LocationSummary,
  ProfessionalSummary,
  Service,
} from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { ConfirmModal, type ConfirmRequest } from "../components/ConfirmModal.js";
import { usePagination } from "../lib/usePagination.js";
import { AppShell } from "../components/AppShell.js";
import { Modal } from "../components/Modal.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { EditProfessionalModal } from "../components/EditProfessionalModal.js";
import { InviteProfessionalModal } from "../components/InviteProfessionalModal.js";
import {
  ActionMenu,
  type ActionMenuItem,
  Alert,
  Button,
  Pill,
  type PillTone,
  Pagination, Table,
  TableHead,
  TableRow,
  TableEmpty,
} from "../components/ui/index.js";

const COLUMNS = "1.3fr 1.6fr 130px 110px 60px";

const TABLE_ROW = "46px";

const LOGIN_STATUS_KEY: Record<ProfessionalSummary["cmsLoginStatus"], string> = {
  none: "professionals.statusNoLogin",
  invited: "professionals.statusInvited",
  active: "professionals.statusCanSignIn",
};
const LOGIN_STATUS_TONE: Record<ProfessionalSummary["cmsLoginStatus"], PillTone> = {
  none: "neutral",
  invited: "warning",
  active: "success",
};

// Rows per page; a pager appears only once there are more.
const PAGE_SIZE = 10;

export function ProfessionalsPage() {
  const { t } = useI18n();
  // The question waiting on an answer, if any (see ConfirmModal).
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const nameOf = useLocalizedName();
  const [professionals, setProfessionals] = useState<ProfessionalSummary[] | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [locations, setLocations] = useState<LocationSummary[] | null>(null);
  const [locales, setLocales] = useState<string[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<ProfessionalSummary | "new" | null>(null);
  const [inviteTarget, setInviteTarget] = useState<ProfessionalSummary | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<{ professional: ProfessionalSummary; count: number } | null>(
    null,
  );
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  function load() {
    Promise.all([
      cachedApi.listProfessionals(),
      cachedApi.listServices(),
      cachedApi.listLocations(),
      cachedApi.getTenant(),
    ])
      .then(([p, s, l, tenant]) => {
        setProfessionals(p);
        setServices(s);
        setLocales(tenant.configJson.enabledLocales ?? []);
        // R150: only open branches can be newly assigned

        setLocations(l.filter((location) => location.isActive));
      })
      .catch(() => setListError(t("professionals.errLoad")));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  function serviceNames(p: ProfessionalSummary): string {
    if (!services || p.serviceIds.length === 0) return t("professionals.noServicesAssigned");
    return p.serviceIds
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => nameOf(s.name, s.nameI18n))
      .join(", ");
  }

  async function handleDeactivateClick(p: ProfessionalSummary) {
    setListError(null);
    try {
      const { count } = await cachedApi.getProfessionalUpcomingCount(p.id);
      setDeactivateTarget({ professional: p, count });
    } catch {
      setListError(t("professionals.errCheckUpcoming"));
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);
    try {
      await cachedApi.updateProfessional(deactivateTarget.professional.id, { isActive: false });
      setDeactivateTarget(null);
      load();
    } catch {
      setListError(t("professionals.errDeactivate"));
    } finally {
      setDeactivateLoading(false);
    }
  }

  async function handleReactivate(p: ProfessionalSummary) {
    setListError(null);
    try {
      await cachedApi.updateProfessional(p.id, { isActive: true });
      load();
    } catch {
      setListError(t("professionals.errReactivate"));
    }
  }

  function handleDelete(p: ProfessionalSummary) {
    setConfirmRequest({
      title: t("professionals.delete"),
      message: t("professionals.confirmDelete", { name: nameOf(p.name, p.nameI18n) }),
      confirmLabel: t("professionals.delete"),
      danger: true,
      run: () => void handleDeleteConfirmed(p),
    });
  }

  async function handleDeleteConfirmed(p: ProfessionalSummary) {
    setListError(null);
    try {
      await cachedApi.deleteProfessional(p.id);
      load();
    } catch (err) {
      setListError(t(err instanceof ApiError ? "professionals.errHasHistory" : "common.somethingWrong"));
    }
  }

  function rowActions(p: ProfessionalSummary): ActionMenuItem[] {
    return [
      { label: t("professionals.edit"), icon: "edit", onSelect: () => setEditTarget(p) },
      { label: t("professionals.hours"), icon: "schedule", to: `/hours?professionalId=${p.id}` },
      ...(p.cmsLoginStatus === "none"
        ? ([{ label: t("professionals.invite"), icon: "mail", onSelect: () => setInviteTarget(p) }] satisfies ActionMenuItem[])
        : []),
      p.isActive
        ? { label: t("professionals.deactivate"), icon: "visibility_off", onSelect: () => handleDeactivateClick(p) }
        : { label: t("professionals.reactivate"), icon: "visibility", onSelect: () => handleReactivate(p) },
      // R80: delete is only offered for someone who was never booked
      ...(p.hasAppointmentHistory
        ? []
        : ([{ label: t("professionals.delete"), icon: "delete", danger: true, onSelect: () => handleDelete(p) }] satisfies ActionMenuItem[])),
    ];
  }

  const pager = usePagination(professionals ?? [], PAGE_SIZE);

  return (
    <AppShell title={t("professionals.title")} subtitle={t("professionals.subtitle")}>
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
          <Button className="ml-auto" icon="person_add" onClick={() => setEditTarget("new")}>
            {t("professionals.add")}
          </Button>
        </div>

        {listError && <Alert>{listError}</Alert>}

        {professionals && (
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHead columns={COLUMNS}>
                <div>{t("professionals.colName")}</div>
                <div>{t("professionals.colServices")}</div>
                <div>{t("professionals.colLogin")}</div>
                <div>{t("professionals.colStatus")}</div>
                <div></div>
              </TableHead>
              {pager.pageItems.map((p) => (
                <TableRow key={p.id} columns={COLUMNS}>
                  <div className="font-semibold">{nameOf(p.name, p.nameI18n)}</div>
                  <div className="text-[13px] text-base-content/60">{serviceNames(p)}</div>
                  <div>
                    <Pill tone={LOGIN_STATUS_TONE[p.cmsLoginStatus]}>{t(LOGIN_STATUS_KEY[p.cmsLoginStatus])}</Pill>
                  </div>
                  <div>
                    <Pill tone={p.isActive ? "success" : "danger"}>
                      {t(p.isActive ? "professionals.active" : "professionals.inactive")}
                    </Pill>
                  </div>
                  <div className="flex justify-end">
                    <ActionMenu ariaLabel={t("common.rowActions", { name: nameOf(p.name, p.nameI18n) })} items={rowActions(p)} />
                  </div>
                </TableRow>
              ))}
              {professionals.length === 0 && <TableEmpty>{t("professionals.empty")}</TableEmpty>}
            </Table>
            <Pagination {...pager} />
          </div>
        )}
        {!professionals && <CardSkeleton rows={5} rowHeight={TABLE_ROW} />}
      </div>

      {editTarget && (
        <EditProfessionalModal
          target={editTarget}
          services={services ?? []}
          locales={locales}
          locations={locations ?? []}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            load();
          }}
        />
      )}

      {inviteTarget && <InviteProfessionalModal professional={inviteTarget} onClose={() => setInviteTarget(null)} />}

      {deactivateTarget && (
        <Modal
          title={t("professionals.deactivateTitle")}
          onClose={() => setDeactivateTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeactivateTarget(null)} disabled={deactivateLoading}>
                {t("common.cancel")}
              </Button>
              <Button onClick={confirmDeactivate} disabled={deactivateLoading}>
                {deactivateLoading ? t("professionals.deactivating") : t("professionals.deactivate")}
              </Button>
            </>
          }
        >
          {deactivateTarget.count > 0 ? (
            <Alert flush variant="warning">
              {t(deactivateTarget.count === 1 ? "professionals.upcomingWarning_one" : "professionals.upcomingWarning_other", {
                count: deactivateTarget.count,
                name: nameOf(deactivateTarget.professional.name, deactivateTarget.professional.nameI18n),
              })}
            </Alert>
          ) : (
            <p className="text-base-content/70">
              {t("professionals.noUpcoming", { name: nameOf(deactivateTarget.professional.name, deactivateTarget.professional.nameI18n) })}
            </p>
          )}
        </Modal>
      )}
      {confirmRequest && <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />}
    </AppShell>
  );
}
