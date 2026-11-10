import { useEffect, useState } from "react";
import { VISIT_GAP_OPTIONS } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { Alert, Button, Card, Eyebrow, Field, Select } from "./ui/index.js";

/**
 * R220: the longest idle gap between two segments of a customer's visit (a
 * booking whose services are done by different professionals, R200). Owner
 * only — it changes what every customer is offered. Self-contained: it loads
 * and saves the tenant setting itself, so the Hours page just places it.
 */
export function VisitGapCard() {
  const { t } = useI18n();
  const [saved, setSaved] = useState<number | null>(null);
  const [value, setValue] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"saved" | "error" | null>(null);

  useEffect(() => {
    cachedApi
      .getTenant()
      .then((tenant) => {
        setSaved(tenant.maxVisitGapMinutes);
        setValue(tenant.maxVisitGapMinutes);
      })
      .catch(() => setStatus("error"));
  }, []);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const tenant = await cachedApi.updateTenantBookingRules({ maxVisitGapMinutes: value });
      setSaved(tenant.maxVisitGapMinutes);
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  const options = VISIT_GAP_OPTIONS.map((minutes) => ({
    value: String(minutes),
    label: minutes === 0 ? t("hours.gapNone") : t("hours.gapMinutes", { count: minutes }),
  }));

  return (
    <Card className="px-5 py-4">
      <Eyebrow className="mb-1">{t("hours.gapTitle")}</Eyebrow>
      <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-base-content/60">{t("hours.gapHint")}</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label={t("hours.gapLabel")} htmlFor="visit-gap" flush className="sm:w-72">
          <Select
            id="visit-gap"
            value={String(value)}
            onChange={(next) => {
              setValue(Number(next));
              setStatus(null);
            }}
            options={options}
            disabled={saved === null || saving}
          />
        </Field>
        <Button onClick={save} disabled={saved === null || saving || value === saved}>
          {saving ? t("common.saving") : t("hours.gapSave")}
        </Button>
        {status === "saved" && (
          <span className="text-[13px] text-success sm:pb-2.5" role="status">
            {t("hours.gapSaved")}
          </span>
        )}
      </div>
      {status === "error" && (
        <Alert flush className="mt-3">
          {t("hours.gapErr")}
        </Alert>
      )}
    </Card>
  );
}
