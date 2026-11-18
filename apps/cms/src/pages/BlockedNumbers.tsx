import { useEffect, useState } from "react";
import type { BlockedPhone } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { ConfirmModal, type ConfirmRequest } from "../components/ConfirmModal.js";
import { usePagination } from "../lib/usePagination.js";
import { AppShell } from "../components/AppShell.js";
import { BlockPhoneModal } from "../components/BlockPhoneModal.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { Alert, Button, Pagination, Table, TableEmpty, TableHead, TableRow } from "../components/ui/index.js";
import { formatPhone } from "../lib/formatPhone.js";
import { formatShortDate } from "../lib/tenantTime.js";

const COLUMNS = "minmax(0,1fr) minmax(0,1.4fr) 120px 110px";
const TABLE_ROW = "48px";

/**
 * R380: the numbers this salon has stopped from booking online. The list is
 * the salon's own — a number blocked here books freely anywhere else, and
 * staff can still book it from the CMS.
 */
// Rows per page; a pager appears only once there are more.
const PAGE_SIZE = 10;

export function BlockedNumbersPage() {
  const { t, lang } = useI18n();
  const [blocked, setBlocked] = useState<BlockedPhone[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // The question waiting on an answer, if any (see ConfirmModal).
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const pager = usePagination(blocked ?? [], PAGE_SIZE);

  function load() {
    cachedApi
      .listBlockedPhones()
      .then(setBlocked)
      .catch(() => setError(t("blocked.errLoad")));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function unblock(entry: BlockedPhone) {
    setConfirmRequest({
      title: t("blocked.unblock"),
      message: t("blocked.confirmUnblock", { phone: formatPhone(entry.phoneNumber) }),
      confirmLabel: t("blocked.unblock"),
      run: () => {
        setError(null);
        cachedApi
          .unblockPhone({ phoneNumber: entry.phoneNumber })
          .then(load)
          .catch(() => setError(t("common.somethingWrong")));
      },
    });
  }

  const dateOf = (iso: string) => formatShortDate(iso, lang);

  return (
    <AppShell title={t("blocked.title")} subtitle={t("blocked.subtitle")}>
      <div className="max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
          <Button icon="block" onClick={() => setAddOpen(true)}>
            {t("blocked.add")}
          </Button>
        </div>

        {error && <Alert>{error}</Alert>}

        {blocked && (
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHead columns={COLUMNS}>
                <div>{t("blocked.colNumber")}</div>
                <div>{t("blocked.colReason")}</div>
                <div>{t("blocked.colSince")}</div>
                <div />
              </TableHead>
              {blocked.length === 0 && <TableEmpty>{t("blocked.empty")}</TableEmpty>}
              {pager.pageItems.map((entry) => (
                <TableRow key={entry.id} columns={COLUMNS}>
                  <div className="font-semibold tabular-nums">{formatPhone(entry.phoneNumber)}</div>
                  <div className="text-[13px] text-base-content/60">{entry.reason ?? "—"}</div>
                  <div className="text-[13px] tabular-nums">{dateOf(entry.createdAt)}</div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="secondary" onClick={() => unblock(entry)}>
                      {t("blocked.unblock")}
                    </Button>
                  </div>
                </TableRow>
              ))}
            </Table>
            <Pagination {...pager} />
          </div>
        )}
        {!blocked && !error && <CardSkeleton rows={3} rowHeight={TABLE_ROW} subtitle={false} />}

        <p className="mt-3 text-xs leading-relaxed text-base-content/60">{t("blocked.scopeNote")}</p>
      </div>

      {addOpen && (
        <BlockPhoneModal
          onClose={() => setAddOpen(false)}
          onBlocked={() => {
            setAddOpen(false);
            load();
          }}
        />
      )}
      {confirmRequest && <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />}
    </AppShell>
  );
}
