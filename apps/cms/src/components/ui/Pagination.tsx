import { useI18n } from "../../i18n/I18nContext.js";
import { cx } from "../../lib/cx.js";
import { Button } from "./Button.js";

interface PaginationProps {
  /** 1-based. */
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  setPage: (page: number) => void;
  className?: string;
}

/**
 * The pager under a table or list: which rows are showing, and the way to the
 * next and previous page. Takes a `usePagination` result as-is
 * (`<Pagination {...pager} />`) and renders nothing while everything fits on
 * one page, so short lists look exactly as they did.
 */
export function Pagination({ page, pageCount, from, to, total, setPage, className }: PaginationProps) {
  const { t } = useI18n();

  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav
      className={cx("mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px]", className)}
      aria-label={t("common.pagination")}
    >
      <p className="text-base-content/60 tabular-nums" aria-live="polite">
        {t("common.pageRange", { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          iconOnly
          icon="chevron_left"
          title={t("common.prevPage")}
          aria-label={t("common.prevPage")}
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        />
        <span className="tabular-nums">{t("common.pageOf", { page, pageCount })}</span>
        <Button
          size="sm"
          variant="secondary"
          iconOnly
          icon="chevron_right"
          title={t("common.nextPage")}
          aria-label={t("common.nextPage")}
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
        />
      </div>
    </nav>
  );
}
