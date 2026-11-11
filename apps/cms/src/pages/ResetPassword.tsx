import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MIN_PASSWORD_LENGTH } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { cmsApiClient } from "../lib/api.js";
import { passwordProblem } from "../lib/passwordRules.js";
import { AuthLayout } from "../components/AuthLayout.js";
import { Alert, Button, Field, TextInput } from "../components/ui/index.js";

/**
 * R310: the link from the reset email. Using it signs the user in and ends
 * every other session they had (R320).
 */
export function ResetPasswordPage() {
  const { tenantId, token } = useParams<{ tenantId: string; token: string }>();
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = passwordProblem(password, confirm);
    if (problem) {
      setError(t(problem, { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (!tenantId || !token) {
      setExpired(true);
      return;
    }

    setSubmitting(true);
    try {
      login(await cmsApiClient.resetPassword({ tenantId, token, password }));
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setExpired(true);
      else setError(t(err instanceof ApiError && err.status === 429 ? "forgotPassword.errTooMany" : "common.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline={t("resetPassword.artHeadline")}
      artSub={t("resetPassword.artSub")}
      title={t("resetPassword.title")}
      subtitle={t("resetPassword.subtitle", { min: MIN_PASSWORD_LENGTH })}
      onSubmit={handleSubmit}
    >
      {expired ? (
        <>
          <Alert variant="warning">{t("resetPassword.errLinkExpired")}</Alert>
          <Link to="/forgot-password" className="btn btn-primary w-full">
            {t("resetPassword.requestNew")}
          </Link>
        </>
      ) : (
        <>
          <Field label={t("setPassword.passwordLabel")} htmlFor="password">
            <TextInput
              id="password"
              type="password"
              autoComplete="new-password"
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
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("common.passwordPlaceholder")}
              required
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? t("resetPassword.submitting") : t("resetPassword.submit")}
          </Button>
        </>
      )}
    </AuthLayout>
  );
}
