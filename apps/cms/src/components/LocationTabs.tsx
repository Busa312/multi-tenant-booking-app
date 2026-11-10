import type { LocationSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { cx } from "../lib/cx.js";

interface LocationTabsProps {
  locations: LocationSummary[];
  /** null = every branch, which is the default and preserves the unfiltered view. */
  selectedId: string | null;
  onSelect: (locationId: string | null) => void;
}

// R150: nothing to switch between below this, so the strip stays hidden — a
// tenant with one branch (or none) should never see a filter for it.
const MIN_TABS = 2;

// Underlined tabs rather than filled pills: this sits directly above a table,
// and a solid block reads as a heading row.
export function LocationTabs({ locations, selectedId, onSelect }: LocationTabsProps) {
  const { t } = useI18n();
  const nameOf = useLocalizedName();

  if (locations.length < MIN_TABS) {
    return null;
  }

  const tabs: { id: string | null; label: string }[] = [
    { id: null, label: t("locations.allTab") },
    ...locations.map((location) => ({ id: location.id, label: nameOf(location.name, location.nameI18n) })),
  ];

  return (
    <div
      className="tabs tabs-border flex-nowrap overflow-x-auto border-b border-base-300"
      role="tablist"
      aria-label={t("locations.filterLabel")}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id ?? "all"}
          type="button"
          role="tab"
          aria-selected={tab.id === selectedId}
          className={cx("tab flex-none font-semibold whitespace-nowrap", tab.id === selectedId && "tab-active text-primary")}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
