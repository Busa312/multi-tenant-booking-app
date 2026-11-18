import type { ServiceSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { usePagination } from "../lib/usePagination.js";
import { ServiceTableRow } from "./ServiceTableRow.js";
import { ActionMenu, type ActionMenuItem, Button, Pagination, Table, TableEmpty, TableHead } from "./ui/index.js";

interface ServiceCategorySectionProps {
  /** The category's name, or the heading of the uncategorized services. */
  title: string;
  services: ServiceSummary[];
  /** R510: rename/delete — absent for the uncategorized group, which isn't a category. */
  categoryActions?: ActionMenuItem[];
  /** R510: absent at the top (or bottom) of the list, and for the uncategorized group. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddService: () => void;
  professionalNames: (service: ServiceSummary) => string[];
  serviceActions: (service: ServiceSummary) => ActionMenuItem[];
  /** Moves the service at `index` (in this category) one place. */
  onMoveService: (index: number, direction: -1 | 1) => void;
  busy: boolean;
}

const COLUMNS = "72px 1.3fr 90px 110px 1.4fr 100px 60px";
// Rows per page within one category; a pager appears only once there are more.
const PAGE_SIZE = 15;

/** R510: one heading of the price list on the Services page — the category, its order, and its services in theirs. */
export function ServiceCategorySection({
  title,
  services,
  categoryActions,
  onMoveUp,
  onMoveDown,
  onAddService,
  professionalNames,
  serviceActions,
  onMoveService,
  busy,
}: ServiceCategorySectionProps) {
  const { t } = useI18n();
  const pager = usePagination(services, PAGE_SIZE);
  const isCategory = categoryActions !== undefined;

  return (
    <section className="mb-6" aria-label={title}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 font-display text-xl leading-tight font-bold">
          {title} <span className="text-sm font-normal text-base-content/60 tabular-nums">· {services.length}</span>
        </h2>
        {isCategory && (
          <div className="flex">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon="arrow_upward"
              aria-label={t("services.moveCategoryUp", { name: title })}
              title={t("services.moveCategoryUp", { name: title })}
              disabled={busy || !onMoveUp}
              onClick={onMoveUp}
            />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon="arrow_downward"
              aria-label={t("services.moveCategoryDown", { name: title })}
              title={t("services.moveCategoryDown", { name: title })}
              disabled={busy || !onMoveDown}
              onClick={onMoveDown}
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="secondary" size="sm" icon="add" disabled={busy} onClick={onAddService}>
            {t("services.addHere")}
          </Button>
          {categoryActions && <ActionMenu ariaLabel={t("common.rowActions", { name: title })} items={categoryActions} />}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[840px]">
          <TableHead columns={COLUMNS}>
            {/* Its own grid cell; only the label inside is visually hidden. */}
            <div>
              <span className="sr-only">{t("services.colOrder")}</span>
            </div>
            <div>{t("services.colName")}</div>
            <div>{t("services.colDuration")}</div>
            <div>{t("services.colPrice")}</div>
            <div>{t("services.colProfessionals")}</div>
            <div>{t("services.colStatus")}</div>
            <div></div>
          </TableHead>
          {pager.pageItems.map((service) => {
            const index = services.indexOf(service);
            return (
              <ServiceTableRow
                key={service.id}
                service={service}
                columns={COLUMNS}
                professionalNames={professionalNames(service)}
                actions={serviceActions(service)}
                onMoveUp={index > 0 ? () => onMoveService(index, -1) : undefined}
                onMoveDown={index < services.length - 1 ? () => onMoveService(index, 1) : undefined}
                busy={busy}
              />
            );
          })}
          {services.length === 0 && <TableEmpty>{t(isCategory ? "services.categoryEmpty" : "services.empty")}</TableEmpty>}
        </Table>
        <Pagination {...pager} />
      </div>
    </section>
  );
}
