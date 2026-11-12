import type { AppointmentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { serviceLabel } from "../lib/appointmentServices.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { formatDateTimeLabel } from "../lib/tenantTime.js";
import { Button } from "./ui/index.js";

interface NeedsMarkingRowProps {
  appointment: AppointmentSummary;
  timezone: string;
  /** True while this row's status is being saved. */
  saving: boolean;
  /** True while any row is saving: one write at a time keeps the list from jumping. */
  disabled: boolean;
  onMark: (appointment: AppointmentSummary, status: "completed" | "no_show") => void;
}

/** R100: one past appointment nobody has marked yet, with the two answers a person can give. */
export function NeedsMarkingRow({ appointment, timezone, saving, disabled, onMark }: NeedsMarkingRowProps) {
  const { t, lang } = useI18n();
  const nameOf = useLocalizedName();

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3" aria-busy={saving}>
      <div className="min-w-0 flex-1 basis-56">
        <div className="truncate text-[13.5px] font-semibold">{appointment.userName}</div>
        <div className="truncate text-xs text-base-content/60">
          {formatDateTimeLabel(appointment.startAt, timezone, lang)} · {serviceLabel(appointment, nameOf)}
          {appointment.professionalName && ` · ${nameOf(appointment.professionalName, appointment.professionalNameI18n)}`}
        </div>
      </div>
      <div className="flex flex-none gap-2">
        <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onMark(appointment, "completed")}>
          {t("dashboard.markCame")}
        </Button>
        <Button size="sm" variant="secondary" danger disabled={disabled} onClick={() => onMark(appointment, "no_show")}>
          {t("dashboard.markNoShow")}
        </Button>
      </div>
    </li>
  );
}
