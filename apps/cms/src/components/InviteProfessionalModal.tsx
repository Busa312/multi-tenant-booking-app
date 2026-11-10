import { useState, type FormEvent } from "react";
import type { InviteProfessionalResponse, ProfessionalSummary } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { Modal } from "./Modal.js";
import { Alert, Button, Field, InputGroup, TextInput } from "./ui/index.js";

interface InviteProfessionalModalProps {
  professional: ProfessionalSummary;
  onClose: () => void;
}

export function InviteProfessionalModal({ professional, onClose }: InviteProfessionalModalProps) {
  const { t, lang } = useI18n();
  const nameOf = useLocalizedName();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteProfessionalResponse | null>(null);

  const setPasswordUrl = result ? `${window.location.origin}/set-password/${result.tenantId}/${result.token}` : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await cachedApi.inviteProfessional(professional.id, { email });
      setResult(res);
    } catch (err) {
      setError(t(err instanceof ApiError ? "professionals.errEmailInUse" : "common.somethingWrong"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title={t("professionals.inviteTitle", { name: nameOf(professional.name, professional.nameI18n) })} onClose={onClose}>
      {!result ? (
        <form onSubmit={handleSubmit}>
          <Field label={t("professionals.inviteEmailLabel")} htmlFor="invite-email">
            <TextInput
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("professionals.inviteEmailPlaceholder")}
              required
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" fullWidth disabled={sending}>
            {sending ? t("professionals.sending") : t("professionals.createLink")}
          </Button>
        </form>
      ) : (
        <div>
          <Alert variant="success">
            {t("professionals.inviteSuccess", {
              email: result.email,
              date: new Date(result.expiresAt).toLocaleDateString(lang === "ka" ? "ka-GE" : "en-US"),
            })}
          </Alert>
          <InputGroup
            readOnly
            value={setPasswordUrl ?? ""}
            className="mb-4"
            action={{ label: t("common.copy"), onClick: () => setPasswordUrl && navigator.clipboard.writeText(setPasswordUrl) }}
          />
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            {t("common.done")}
          </Button>
        </div>
      )}
    </Modal>
  );
}
