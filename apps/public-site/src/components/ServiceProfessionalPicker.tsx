"use client";

import { useId } from "react";
import type { PublicProfessional } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";

interface ServiceProfessionalPickerProps {
  position: number;
  serviceName: string;
  /** Only people who perform this service at this branch. */
  qualified: PublicProfessional[];
  /** null = any available. */
  value: string | null;
  onChange: (professionalId: string | null) => void;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

// R200: who performs one service of the visit. A native select: it's one
// choice among a handful, and the OS picker is the best one on a phone.
export function ServiceProfessionalPicker({
  position,
  serviceName,
  qualified,
  value,
  onChange,
  t,
  text,
}: ServiceProfessionalPickerProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-4 sm:flex-row sm:items-center sm:gap-4">
      <label htmlFor={id} className="flex min-w-0 flex-1 items-center gap-2.5 font-semibold">
        <span className="badge badge-primary badge-sm tabular-nums">{position}</span>
        <span className="truncate">{serviceName}</span>
      </label>
      <select
        id={id}
        className="select w-full sm:w-60"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
      >
        <option value="">{t("booking.professional.any")}</option>
        {qualified.map((professional) => (
          <option key={professional.id} value={professional.id}>
            {text(professional.name, professional.nameI18n)}
          </option>
        ))}
      </select>
    </div>
  );
}
