import type { ProfessionalSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { Card, Field, Select } from "./ui/index.js";

interface HoursScopePickerProps {
  professionals: ProfessionalSummary[];
  /** null = the organisation-wide schedule. */
  value: string | null;
  onChange: (professionalId: string | null) => void;
}

/**
 * Whose schedule is being edited. Previously this was reachable only by landing
 * on the page with a `?professionalId=` link from the Professionals table, so
 * there was no way to move between schedules — or to discover that per-person
 * schedules existed at all.
 */
export function HoursScopePicker({ professionals, value, onChange }: HoursScopePickerProps) {
  const { t } = useI18n();
  const nameOf = useLocalizedName();

  // Deactivated professionals stay listed only while they're the current scope,
  // so an existing deep link still resolves instead of silently snapping back.
  const options = [
    { value: "", label: t("hours.scopeOrganisation") },
    ...professionals.filter((p) => p.isActive || p.id === value).map((p) => ({ value: p.id, label: nameOf(p.name, p.nameI18n) })),
  ];

  return (
    <Card className="px-5 py-4">
      <Field label={t("hours.scopeLabel")} htmlFor="hours-scope" flush className="sm:max-w-[340px]">
        <Select
          id="hours-scope"
          value={value ?? ""}
          onChange={(next) => onChange(next === "" ? null : next)}
          options={options}
        />
      </Field>
    </Card>
  );
}
