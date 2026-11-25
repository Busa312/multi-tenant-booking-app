import { useEffect, useState } from "react";
import {
  BOOKING_ADVANCE_OPTIONS,
  BOOKING_NOTICE_OPTIONS,
  CHANGE_CUTOFF_OPTIONS,
  REMINDER_HOURS_OPTIONS,
  TRAVEL_BUFFER_OPTIONS,
  VISIT_GAP_OPTIONS,
  offersHomeVisits,
} from "@booking/shared-types";
import type { Tenant, UpdateTenantBookingRulesRequest } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { Alert, Button, Card, Checkbox, Eyebrow, Field, InputGroup, Select } from "./ui/index.js";

type Rules = Required<UpdateTenantBookingRulesRequest>;
type NumericRule = Exclude<keyof Rules, "customersChooseProfessional" | "homeVisitFee">;

/** R630: an empty field (or 0) is no fee; otherwise an amount with up to two decimals. */
const validFee = (fee: string | null) => fee === null || /^\d{1,8}([.,]\d{1,2})?$/.test(fee);

const rulesOf = (tenant: Tenant): Rules => ({
  maxVisitGapMinutes: tenant.maxVisitGapMinutes,
  minBookingNoticeMinutes: tenant.minBookingNoticeMinutes,
  maxBookingAdvanceDays: tenant.maxBookingAdvanceDays,
  changeCutoffHours: tenant.changeCutoffHours,
  customersChooseProfessional: tenant.customersChooseProfessional,
  reminderHoursBefore: tenant.reminderHoursBefore,
  travelBufferMinutes: tenant.travelBufferMinutes,
  // R630: "0" shows as an empty field — no fee
  homeVisitFee: Number(tenant.homeVisitFee) > 0 ? tenant.homeVisitFee : null,
});

/**
 * What customers may do on the booking site: R220 (gap between specialists),
 * R280 (minimum notice), R290 (how far ahead), R300 (until when they can change
 * or cancel), R440 (whether they pick who serves them), R610 (when the reminder
 * text goes out), R630 (travel time and fee for visits at the customer's
 * address). Owner only. Staff in the CMS are bound by none of these.
 * Self-contained — loads and saves the tenant's rules itself.
 */
export function BookingPoliciesCard() {
  const { t } = useI18n();
  const [saved, setSaved] = useState<Rules | null>(null);
  const [draft, setDraft] = useState<Rules | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"saved" | "error" | "invalidFee" | null>(null);
  // R630: travel time and the fee matter once some service is done at the customer's address
  const [homeVisits, setHomeVisits] = useState(false);

  useEffect(() => {
    cachedApi
      .listServices()
      .then((services) => setHomeVisits(offersHomeVisits(services)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    cachedApi
      .getTenant()
      .then((tenant) => {
        const rules = rulesOf(tenant);
        setSaved(rules);
        setDraft(rules);
      })
      .catch(() => setStatus("error"));
  }, []);

  const dirty = saved !== null && draft !== null && (Object.keys(saved) as (keyof Rules)[]).some((k) => saved[k] !== draft[k]);

  async function save() {
    if (!draft) return;
    if (!validFee(draft.homeVisitFee)) {
      setStatus("invalidFee");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const tenant = await cachedApi.updateTenantBookingRules(draft);
      const rules = rulesOf(tenant);
      setSaved(rules);
      setDraft(rules);
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  const duration = (minutes: number) =>
    minutes < 60 ? t("hours.durationMinutes", { count: minutes }) : t("hours.durationHours", { count: minutes / 60 });

  const fields: { key: NumericRule; id: string; label: string; hint?: string; options: { value: string; label: string }[] }[] = [
    {
      key: "minBookingNoticeMinutes",
      id: "policy-notice",
      label: t("hours.noticeLabel"),
      options: BOOKING_NOTICE_OPTIONS.map((m) => ({ value: String(m), label: m === 0 ? t("hours.noticeNone") : duration(m) })),
    },
    {
      key: "maxBookingAdvanceDays",
      id: "policy-advance",
      label: t("hours.advanceLabel"),
      options: BOOKING_ADVANCE_OPTIONS.map((d) => ({ value: String(d), label: t("hours.durationDays", { count: d }) })),
    },
    {
      key: "changeCutoffHours",
      id: "policy-cutoff",
      label: t("hours.cutoffLabel"),
      options: CHANGE_CUTOFF_OPTIONS.map((h) => ({
        value: String(h),
        label: h === 0 ? t("hours.cutoffNone") : t("hours.cutoffHours", { count: h }),
      })),
    },
    // R630: only once some service is done at the customer's address
    ...(homeVisits
      ? [
          {
            key: "travelBufferMinutes" as const,
            id: "policy-travel",
            label: t("hours.travelLabel"),
            hint: t("hours.travelHint"),
            options: TRAVEL_BUFFER_OPTIONS.map((m) => ({
              value: String(m),
              label: m === 0 ? t("hours.travelNone") : t("hours.travelMinutes", { count: m }),
            })),
          },
        ]
      : []),
    // R610
    {
      key: "reminderHoursBefore",
      id: "policy-reminder",
      label: t("hours.reminderLabel"),
      hint: t("hours.reminderHint"),
      options: REMINDER_HOURS_OPTIONS.map((h) => ({
        value: String(h),
        label: h === 0 ? t("hours.reminderOff") : t("hours.cutoffHours", { count: h }),
      })),
    },
    {
      key: "maxVisitGapMinutes",
      id: "policy-gap",
      label: t("hours.gapLabel"),
      options: VISIT_GAP_OPTIONS.map((m) => ({
        value: String(m),
        label: m === 0 ? t("hours.gapNone") : t("hours.gapMinutes", { count: m }),
      })),
    },
  ];

  return (
    <Card className="px-5 py-4">
      <Eyebrow className="mb-1">{t("hours.policiesTitle")}</Eyebrow>
      <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-base-content/60">{t("hours.policiesHint")}</p>

      <div className="grid gap-x-4 sm:grid-cols-2">
        {fields.map((field) => (
          <Field key={field.key} label={field.label} htmlFor={field.id} hint={field.hint}>
            <Select
              id={field.id}
              value={draft ? String(draft[field.key]) : ""}
              onChange={(next) => {
                if (!draft) return;
                setDraft({ ...draft, [field.key]: Number(next) });
                setStatus(null);
              }}
              options={field.options}
              disabled={draft === null || saving}
            />
          </Field>
        ))}
      </div>

      {/* R630: optional — empty means no fee */}
      {(homeVisits || saved?.homeVisitFee) && (
        <Field label={t("hours.feeLabel")} htmlFor="policy-fee" hint={t("hours.feeHint")} className="max-w-xs">
          <InputGroup
            id="policy-fee"
            inputMode="decimal"
            suffix="₾"
            value={draft?.homeVisitFee ?? ""}
            disabled={draft === null || saving}
            placeholder={t("hours.feeNone")}
            onChange={(e) => {
              if (!draft) return;
              const next = e.target.value.trim();
              setDraft({ ...draft, homeVisitFee: next === "" ? null : next });
              setStatus(null);
            }}
          />
        </Field>
      )}

      {/* R440: off for a business that books services, not people (a car wash) */}
      <div className="mb-4">
        <Checkbox
          checked={draft?.customersChooseProfessional ?? true}
          disabled={draft === null || saving}
          onChange={(checked) => {
            if (!draft) return;
            setDraft({ ...draft, customersChooseProfessional: checked });
            setStatus(null);
          }}
        >
          {t("hours.chooseProfessionalLabel")}
        </Checkbox>
        <p className="ml-7.5 max-w-2xl text-[13px] leading-relaxed text-base-content/60">{t("hours.chooseProfessionalHint")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
        {status === "saved" && (
          <span className="text-[13px] text-success" role="status">
            {t("hours.gapSaved")}
          </span>
        )}
      </div>
      {status === "error" && (
        <Alert flush className="mt-3">
          {t("hours.gapErr")}
        </Alert>
      )}
      {status === "invalidFee" && (
        <Alert flush className="mt-3">
          {t("hours.feeInvalid")}
        </Alert>
      )}
    </Card>
  );
}
