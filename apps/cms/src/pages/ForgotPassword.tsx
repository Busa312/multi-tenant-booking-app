import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@booking/api-client";
import { useI18n } from "../i18n/I18nContext.js";
import { cmsApiClient } from "../lib/api.js";
import { AuthLayout } from "../components/AuthLayout.js";
import { Alert, Button, Field, InputGroup, TextInput } from "../components/ui/index.js";

const PUBLIC_SITE_BASE_DOMAIN = import.meta.env.VITE_PUBLIC_SITE_BASE_DOMAIN as string | undefined;

/**
 * R310: asks for a reset link. The answer is the same whether or not the
 * account exists — the API never says, so neither does this page.
 */
export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [subdomain, setSubdomain] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await cmsApiClient.forgotPassword({ subdomain: subdomain.trim(), email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(t(err instanceof ApiError && err.status === 429 ? "forgotPassword.errTooMany" : "common.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline={t("forgotPassword.artHeadline")}
      artSub={t("forgotPassword.artSub")}
      title={t("forgotPassword.title")}
      subtitle={t("forgotPassword.subtitle")}
      onSubmit={handleSubmit}
    >
      {sent ? (
        <Alert variant="success">{t("forgotPassword.sent")}</Alert>
      ) : (
        <>
          <Field label={t("login.workspaceLabel")} htmlFor="subdomain">
            <InputGroup
              id="subdomain"
              type="text"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder={t("login.workspacePlaceholder")}
              required
              suffix={PUBLIC_SITE_BASE_DOMAIN ? `.${PUBLIC_SITE_BASE_DOMAIN}` : undefined}
            />
          </Field>
          <Field label={t("login.emailLabel")} htmlFor="email">
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.emailPlaceholder")}
              required
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
          </Button>
        </>
      )}
      <Link to="/login" className="link link-hover mt-4 block text-center text-sm">
        {t("forgotPassword.back")}
      </Link>
    </AuthLayout>
  );
}
