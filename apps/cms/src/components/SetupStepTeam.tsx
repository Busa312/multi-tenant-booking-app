import { useState } from "react";
import type { LocationSummary, ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { EditProfessionalModal } from "./EditProfessionalModal.js";
import { InviteProfessionalModal } from "./InviteProfessionalModal.js";
import { Button } from "./ui/index.js";

interface SetupStepTeamProps {
  professionals: ProfessionalSummary[];
  services: ServiceSummary[];
  locations: LocationSummary[];
  locales: string[];
  onChanged: () => void;
}

/**
 * R420 step 4: who does the work, and which services each performs. A
 * service nobody performs can't be booked online (R240). Inviting someone to
 * sign in is optional.
 */
export function SetupStepTeam({ professionals, services, locations, locales, onChanged }: SetupStepTeamProps) {
  const { t } = useI18n();
  const nameOf = useLocalizedName();
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState<ProfessionalSummary | null>(null);
  const active = professionals.filter((professional) => professional.isActive);

  const servicesOf = (professional: ProfessionalSummary) =>
    professional.serviceIds
      .map((id) => services.find((service) => service.id === id))
      .filter((service): service is ServiceSummary => service !== undefined)
      .map((service) => nameOf(service.name, service.nameI18n))
      .join(", ");

  return (
    <>
      <p className="text-base-content/70">{t("setup.teamIntro")}</p>
      {active.length > 0 && (
        <ul className="mt-4 divide-y divide-base-300 border-y border-base-300">
          {active.map((professional) => (
            <li key={professional.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <span className="min-w-0">
                <span className="block font-semibold">{nameOf(professional.name, professional.nameI18n)}</span>
                <span className="block text-sm text-base-content/60">{servicesOf(professional) || t("setup.teamNoServices")}</span>
              </span>
              {professional.cmsLoginStatus === "none" && (
                <Button size="sm" variant="ghost" icon="mail" onClick={() => setInviting(professional)}>
                  {t("professionals.invite")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-4" variant={active.length > 0 ? "secondary" : "primary"} icon="person_add" onClick={() => setAdding(true)}>
        {t("professionals.add")}
      </Button>
      {adding && (
        <EditProfessionalModal
          target="new"
          services={services}
          locales={locales}
          locations={locations}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
      {inviting && (
        <InviteProfessionalModal
          professional={inviting}
          onClose={() => {
            setInviting(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}
