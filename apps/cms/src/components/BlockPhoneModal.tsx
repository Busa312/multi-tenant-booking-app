import { useState, type FormEvent } from "react";
import { ApiError } from "@booking/api-client";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { Modal } from "./Modal.js";
import { Alert, Button, Field, TextInput } from "./ui/index.js";

interface BlockPhoneModalProps {
  onClose: () => void;
  onBlocked: () => void;
}

/** R380: block a number the owner types in — for a customer who isn't on today's bookings. */
export function BlockPhoneModal({ onClose, onBlocked }: BlockPhoneModalProps) {
  const { t } = useI18n();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/\d/.test(phoneNumber)) {
      setError(t("blocked.errNumber"));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await cachedApi.blockPhone({ phoneNumber, reason: reason.trim() || undefined });
      onBlocked();
    } catch (err) {
      setError(
        t(
          err instanceof ApiError && err.status === 409
            ? "blocked.errAlready"
            : err instanceof ApiError && err.status === 400
              ? "blocked.errNumber"
              : "common.somethingWrong",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t("blocked.addTitle")}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="block-phone-form" danger disabled={saving}>
            {saving ? t("common.saving") : t("blocked.block")}
          </Button>
        </>
      }
    >
      <form id="block-phone-form" onSubmit={handleSubmit} noValidate>
        <Field label={t("blocked.numberLabel")} htmlFor="block-phone-number" hint={t("blocked.numberHint")}>
          <TextInput
            id="block-phone-number"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+995 555 00 00 00"
            required
          />
        </Field>
        <Field label={t("blocked.reasonLabel")} htmlFor="block-phone-reason" hint={t("blocked.reasonHint")}>
          <TextInput
            id="block-phone-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("blocked.reasonPlaceholder")}
            maxLength={200}
          />
        </Field>
        {error && <Alert flush>{error}</Alert>}
      </form>
    </Modal>
  );
}
