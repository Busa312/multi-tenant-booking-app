import { useState } from "react";
import { localizedAddress } from "@booking/shared-types";
import type { LocationSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { EditLocationModal } from "./EditLocationModal.js";
import { Button } from "./ui/index.js";

interface SetupStepLocationsProps {
  locations: LocationSummary[];
  locales: string[];
  onChanged: () => void;
}

/** R420 step 1: where the salon works. Skippable — a salon with no branches works from one place (R150). */
export function SetupStepLocations({ locations, locales, onChanged }: SetupStepLocationsProps) {
  const { t } = useI18n();
  const nameOf = useLocalizedName();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <p className="text-base-content/70">{t("setup.locationsIntro")}</p>
      {locations.length > 0 && (
        <ul className="mt-4 divide-y divide-base-300 border-y border-base-300">
          {locations.map((location) => (
            <li key={location.id} className="py-2.5">
              <span className="font-semibold">{nameOf(location.name, location.nameI18n)}</span>
              <span className="block text-sm text-base-content/60">{localizedAddress(location, nameOf)}</span>
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-4" variant="secondary" icon="add" onClick={() => setAdding(true)}>
        {t("locations.add")}
      </Button>
      {adding && (
        <EditLocationModal
          target="new"
          locales={locales}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}
