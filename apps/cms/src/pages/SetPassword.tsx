import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MIN_PASSWORD_LENGTH } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { cmsApiClient } from "../lib/api.js";
import { passwordProblem } from "../lib/passwordRules.js";
import { AuthLayout } from "../components/AuthLayout.js";
import { Alert, Button, Field, TextInput } from "../components/ui/index.js";

// Public route (no RequireAuth) — reached from the link an owner copies out
// of the "Invite to CMS" flow (R50). tenantId travels in the URL alongside
// the token; see apps/api/src/auth/auth.service.ts's setPassword for why.
export function SetPasswordPage() {
  const { tenantId, token } = useParams<{ tenantId: string; token: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // R310: the same rules the API enforces
    const problem = passwordProblem(password, confirm);
    if (problem) {
      setError(t(problem, { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (!tenantId || !token) {
      setError(t("setPassword.errInvalidLink"));
      return;
    }

    setSubmitting(true);
    try {
      login(await cmsApiClient.setPassword({ tenantId, token, password }));
      navigate("/");
    } catch (err) {
      setError(
        t(
          err instanceof ApiError
            ? err.status === 429
              ? "forgotPassword.errTooMany"
              : err.status === 400
                ? "setPassword.errTooShort"
                : "setPassword.errLinkExpired"
            : "common.somethingWrong",
          { min: MIN_PASSWORD_LENGTH },
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline={t("setPassword.artHeadline")}
      artSub={t("setPassword.artSub")}
      title={t("setPassword.title")}
      subtitle={t("setPassword.subtitle")}
      onSubmit={handleSubmit}
    >
      <Field label={t("setPassword.passwordLabel")} htmlFor="password">
        <TextInput
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("common.passwordPlaceholder")}
          required
        />
      </Field>

      <Field label={t("setPassword.confirmLabel")} htmlFor="confirm">
        <TextInput
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t("common.passwordPlaceholder")}
          required
        />
      </Field>

      {error && <Alert>{error}</Alert>}

      <Button type="submit" fullWidth disabled={submitting}>
        {submitting ? t("setPassword.submitting") : t("setPassword.submit")}
      </Button>
    </AuthLayout>
  );
}
