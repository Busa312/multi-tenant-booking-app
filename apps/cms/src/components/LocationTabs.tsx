import type { LocationSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import styles from "./LocationTabs.module.css";

interface LocationTabsProps {
  locations: LocationSummary[];
  /** null = every branch, which is the default and preserves the unfiltered view. */
  selectedId: string | null;
  onSelect: (locationId: string | null) => void;
}

// R150: nothing to switch between below this, so the strip stays hidden — a
// tenant with one branch (or none) should never see a filter for it.
const MIN_TABS = 2;

export function LocationTabs({ locations, selectedId, onSelect }: LocationTabsProps) {
  const { t } = useI18n();

  if (locations.length < MIN_TABS) {
    return null;
  }

  const tabs: { id: string | null; label: string }[] = [
    { id: null, label: t("locations.allTab") },
    ...locations.map((location) => ({ id: location.id, label: location.name })),
  ];

  return (
    <div className={styles.tabs} role="tablist" aria-label={t("locations.filterLabel")}>
      {tabs.map((tab) => (
        <button
          key={tab.id ?? "all"}
          type="button"
          role="tab"
          aria-selected={tab.id === selectedId}
          className={cx(styles.tab, tab.id === selectedId && styles.tabActive)}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
