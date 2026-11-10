import { useState, type FormEvent } from "react";
import type { ProfessionalSummary } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { tenantWallTimeToUtc } from "../lib/tenantTime.js";
import { Modal } from "./Modal.js";
import { Alert, Button, Field, Select, TextInput } from "./ui/index.js";

interface AddTimeOffModalProps {
  professionals: ProfessionalSummary[];
  timezone: string;
  /** Pre-selected scope; locked for a professional login (R20). */
  defaultProfessionalId: string | null;
  locked: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Block out a holiday or a one-off closure.
 *
 * The two datetimes are the *salon's* wall clock, not the staff browser's — an
 * owner working from another timezone must block the hours their customers
 * would have walked in during, so the values go through `tenantWallTimeToUtc`
 * rather than `new Date(...)`.
 */
export function AddTimeOffModal({
  professionals,
  timezone,
  defaultProfessionalId,
  locked,
  onClose,
  onCreated,
}: AddTimeOffModalProps) {
  const { t } = useI18n();
  const nameOf = useLocalizedName();
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const chosen = professionals.find((p) => p.id === professionalId);
  const chosenName = chosen ? nameOf(chosen.name, chosen.nameI18n) : "";

  const options = [
    { value: "", label: t("hours.scopeOrganisation") },
    ...professionals.filter((p) => p.isActive || p.id === professionalId).map((p) => ({ value: p.id, label: nameOf(p.name, p.nameI18n) })),
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!startAt || !endAt) {
      setError(t("hours.errTimeOffRequired"));
      return;
    }
    if (endAt <= startAt) {
      setError(t("hours.errEndBeforeStart"));
      return;
    }

    setSaving(true);
    try {
      await cachedApi.createTimeOff({
        professionalId: professionalId || undefined,
        startAt: tenantWallTimeToUtc(startAt, timezone).toISOString(),
        endAt: tenantWallTimeToUtc(endAt, timezone).toISOString(),
        reason: reason.trim() || undefined,
      });
      onCreated();
    } catch {
      setError(t("hours.errSaveTimeOff"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t("hours.addTimeOff")}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="time-off-form" disabled={saving}>
            {saving ? t("common.saving") : t("hours.blockTimeOff")}
          </Button>
        </>
      }
    >
      <form id="time-off-form" onSubmit={handleSubmit} noValidate>
        <Field label={t("hours.appliesTo")} htmlFor="timeoff-applies-to">
          {locked ? (
            <TextInput
              id="timeoff-applies-to"
              value={chosenName}
              readOnly
              disabled
            />
          ) : (
            <Select id="timeoff-applies-to" value={professionalId} onChange={setProfessionalId} options={options} />
          )}
        </Field>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-3">
          <Field label={t("hours.from")} htmlFor="timeoff-from" className="min-w-0">
            <TextInput
              id="timeoff-from"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </Field>
          <Field label={t("hours.to")} htmlFor="timeoff-to" className="min-w-0">
            <TextInput
              id="timeoff-to"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label={t("hours.reason")} htmlFor="timeoff-reason">
          <TextInput
            id="timeoff-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("hours.reasonPlaceholder")}
          />
        </Field>

        <p className="mb-3 text-xs leading-relaxed text-base-content/60">{t("hours.timezoneHint", { timezone })}</p>

        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
