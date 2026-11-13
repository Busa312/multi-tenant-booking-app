import { useState } from "react";
import type { ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { EditServiceModal } from "./EditServiceModal.js";
import { Button } from "./ui/index.js";

interface SetupStepServicesProps {
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
  locales: string[];
  onChanged: () => void;
}

/** R420 step 3: what the salon offers, how long it takes, what it costs. */
export function SetupStepServices({ services, professionals, locales, onChanged }: SetupStepServicesProps) {
  const { t } = useI18n();
  const nameOf = useLocalizedName();
  const [adding, setAdding] = useState(false);
  const active = services.filter((service) => service.isActive);

  return (
    <>
      <p className="text-base-content/70">{t("setup.servicesIntro")}</p>
      {active.length > 0 && (
        <ul className="mt-4 divide-y divide-base-300 border-y border-base-300">
          {active.map((service) => (
            <li key={service.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="min-w-0 truncate font-semibold">{nameOf(service.name, service.nameI18n)}</span>
              <span className="flex-none text-sm text-base-content/60 tabular-nums">
                {t("services.minutes", { count: service.durationMinutes })} · {t("services.priceValue", { price: service.price })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-4" variant={active.length > 0 ? "secondary" : "primary"} icon="add" onClick={() => setAdding(true)}>
        {t("services.add")}
      </Button>
      {adding && (
        <EditServiceModal
          target="new"
          professionals={professionals}
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
