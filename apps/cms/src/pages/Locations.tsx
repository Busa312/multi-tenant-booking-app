import { useEffect, useState } from "react";
import type { LocationSummary } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { AppShell } from "../components/AppShell.js";
import { EditLocationModal } from "../components/EditLocationModal.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
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
import styles from "./Locations.module.css";

const COLUMNS = "1.2fr 1.6fr 1fr 100px 60px";
const TABLE_ROW = "46px";

interface PageData {
  locations: LocationSummary[];
  enabledLocales: string[];
}

// R150: the tenant's branches
export function LocationsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<PageData | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<LocationSummary | "new" | null>(null);

  function load() {
    Promise.all([cachedApi.listLocations(), cachedApi.getTenant()])
      .then(([locations, tenant]) => {
        setData({ locations, enabledLocales: tenant.configJson.enabledLocales ?? [] });
      })
      .catch(() => setListError(t("locations.errLoad")));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  function handleSaved() {
    setEditTarget(null);
    load();
  }

  async function setActive(location: LocationSummary, isActive: boolean) {
    setListError(null);
    try {
      await cachedApi.updateLocation(location.id, { isActive });
      load();
    } catch {
      setListError(t("locations.errSave"));
    }
  }

  async function handleDelete(location: LocationSummary) {
    if (!window.confirm(t("locations.confirmDelete", { name: location.name }))) return;
    setListError(null);
    try {
      await cachedApi.deleteLocation(location.id);
      load();
    } catch (err) {
      // R190: the API answers 409 for a branch with history

      // R190: only a 409 means "has history" — a dead session or a 500 must not
      // be reported to the owner as an appointment-history conflict.
      const isConflict = err instanceof ApiError && err.status === 409;
      setListError(t(isConflict ? "locations.errHasHistory" : "common.somethingWrong"));
    }
  }

  function rowActions(location: LocationSummary): ActionMenuItem[] {
    return [
      { label: t("locations.edit"), icon: "edit", onSelect: () => setEditTarget(location) },
      location.isActive
        ? { label: t("locations.deactivate"), icon: "visibility_off", onSelect: () => setActive(location, false) }
        : { label: t("locations.reactivate"), icon: "visibility", onSelect: () => setActive(location, true) },
      ...(location.hasAppointmentHistory
        ? []
        : [{ label: t("locations.delete"), icon: "delete", danger: true, onSelect: () => handleDelete(location) }]),
    ];
  }

  return (
    <AppShell title={t("locations.title")} subtitle={t("locations.subtitle")}>
      <div className="fade-up">
        <div className={styles.toolbar}>
          <div className={styles.count}>
            {data ? t("locations.count", { count: data.locations.length }) : t("common.loading")}
          </div>
          <Button className={styles.add} icon="add" disabled={!data} onClick={() => setEditTarget("new")}>
            {t("locations.add")}
          </Button>
        </div>

        {listError && <Alert>{listError}</Alert>}

        {data?.locations.length === 0 && <Alert variant="warning">{t("locations.firstLocationNotice")}</Alert>}

        {data && data.locations.length > 0 && (
          <div className={styles.tableScroll}>
            <Table className={styles.table}>
              <TableHead columns={COLUMNS}>
                <div>{t("locations.colName")}</div>
                <div>{t("locations.colAddress")}</div>
                <div>{t("locations.colStaff")}</div>
                <div>{t("locations.colStatus")}</div>
                <div></div>
              </TableHead>
              {data.locations.map((location) => (
                <TableRow key={location.id} columns={COLUMNS}>
                  <div className={styles.name}>{location.name}</div>
                  <div className={styles.cell}>
                    {location.city ? `${location.addressLine}, ${location.city}` : location.addressLine}
                  </div>
                  <div className={styles.cell}>
                    {t("locations.staffCount", { count: location.professionalIds.length })}
                  </div>
                  <div>
                    <Pill tone={location.isActive ? "success" : "danger"}>
                      {t(location.isActive ? "locations.active" : "locations.inactive")}
                    </Pill>
                  </div>
                  <div className={styles.actions}>
                    <ActionMenu
                      ariaLabel={t("common.rowActions", { name: location.name })}
                      items={rowActions(location)}
                    />
                  </div>
                </TableRow>
              ))}
              {data.locations.length === 0 && <TableEmpty>{t("locations.empty")}</TableEmpty>}
            </Table>
          </div>
        )}
        {!data && <CardSkeleton rows={4} rowHeight={TABLE_ROW} />}
      </div>

      {editTarget && data && (
        <EditLocationModal
          target={editTarget}
          locales={data.enabledLocales}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </AppShell>
  );
}
