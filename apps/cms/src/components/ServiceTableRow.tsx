import type { ServiceSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { PillList } from "./PillList.js";
import { ActionMenu, type ActionMenuItem, Button, Pill, TableRow } from "./ui/index.js";

interface ServiceTableRowProps {
  service: ServiceSummary;
  /** The grid template shared with the section's TableHead. */
  columns: string;
  professionalNames: string[];
  actions: ActionMenuItem[];
  /** R510: absent at the top (or bottom) of the category. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  busy: boolean;
}

// A service many people perform would otherwise grow its row a line per few
// names; past this many the rest fold into a "+N" chip that lists them.
const MAX_PROFESSIONAL_CHIPS = 2;

/** One service on the Services page, with the arrows that set its place in its category (R510). */
export function ServiceTableRow({ service: s, columns, professionalNames, actions, onMoveUp, onMoveDown, busy }: ServiceTableRowProps) {
  const { t } = useI18n();
  const nameOf = useLocalizedName();
  const name = nameOf(s.name, s.nameI18n);

  return (
    <TableRow columns={columns}>
      <div className="flex">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon="arrow_upward"
          aria-label={t("services.moveUp", { name })}
          title={t("services.moveUp", { name })}
          disabled={busy || !onMoveUp}
          onClick={onMoveUp}
        />
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon="arrow_downward"
          aria-label={t("services.moveDown", { name })}
          title={t("services.moveDown", { name })}
          disabled={busy || !onMoveDown}
          onClick={onMoveDown}
        />
      </div>
      <div>
        <div className="font-semibold">{name}</div>
        {s.description && <div className="mt-0.5 line-clamp-2 text-xs text-base-content/60">{nameOf(s.description, s.descriptionI18n)}</div>}
      </div>
      <div className="text-[13.5px] tabular-nums">{t("services.minutes", { count: s.durationMinutes })}</div>
      {/* R520 */}
      <div className="text-[13.5px] font-medium tabular-nums">
        {t(s.priceFrom ? "services.priceFromValue" : "services.priceValue", { price: s.price })}
      </div>
      <div className="flex flex-wrap gap-1">
        <PillList items={professionalNames} max={MAX_PROFESSIONAL_CHIPS} />
        {s.professionalIds.length === 0 && <Pill tone="warning">{t("services.noneAssigned")}</Pill>}
      </div>
      <div>
        <Pill tone={s.isActive ? "success" : "danger"}>{t(s.isActive ? "services.active" : "services.inactive")}</Pill>
      </div>
      <div className="flex justify-end">
        <ActionMenu ariaLabel={t("common.rowActions", { name })} items={actions} />
      </div>
    </TableRow>
  );
}
