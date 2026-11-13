import { useEffect, useState } from "react";

export interface Pager<T> {
  /** The rows of the current page. */
  pageItems: T[];
  /** 1-based. */
  page: number;
  pageCount: number;
  /** 1-based positions of the first and last row shown; 0 when there are none. */
  from: number;
  to: number;
  total: number;
  setPage: (page: number) => void;
}

/**
 * Splits a list that is already loaded into pages. The lists the CMS shows are
 * a salon's own services, staff, branches and one day of bookings — short
 * enough to load whole — so paging is about what fits on screen, not about
 * what is fetched.
 *
 * The page survives the list changing under it (a row edited, deleted or
 * re-marked reloads the list) and is only clamped when it would fall off the
 * end. Pass `resetKey` for a change that makes it a different list — another
 * day, another branch — and it goes back to the first page.
 */
export function usePagination<T>(items: readonly T[], pageSize: number, resetKey?: string): Pager<T> {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;

  return {
    pageItems: items.slice(start, start + pageSize),
    page: current,
    pageCount,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
    total: items.length,
    setPage,
  };
}
