import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@booking/api-client";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { cmsApiClient } from "../lib/api.js";
import { AuthLayout } from "../components/AuthLayout.js";
import { Alert, Button, Field, Icon, InputGroup, TextInput } from "../components/ui/index.js";

const PUBLIC_SITE_BASE_DOMAIN = import.meta.env.VITE_PUBLIC_SITE_BASE_DOMAIN as string | undefined;

export function LoginPage() {
  const [subdomain, setSubdomain] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login, sessionExpired } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { accessToken } = await cmsApiClient.login({ subdomain, email, password });
      login(accessToken);
      navigate("/");
    } catch (err) {
      setError(t(err instanceof ApiError ? "login.errorInvalid" : "common.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline={t("login.artHeadline")}
      artSub={t("login.artSub")}
      title={t("login.title")}
      subtitle={t("login.subtitle")}
      onSubmit={handleSubmit}
    >
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("login.emailPlaceholder")}
          required
        />
      </Field>

      <Field label={t("login.passwordLabel")} htmlFor="password">
        <TextInput
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("common.passwordPlaceholder")}
          required
        />
      </Field>

      {/* Says why they're back here, rather than leaving a timed-out session
          looking like the app forgot them. A live credential error wins. */}
      {sessionExpired && !error && <Alert variant="warning">{t("login.sessionExpired")}</Alert>}
      {error && <Alert>{error}</Alert>}

      <Button type="submit" fullWidth disabled={submitting}>
        {submitting ? t("login.submitting") : t("login.submit")}
        <Icon name="arrow_forward" size={19} />
      </Button>
    </AuthLayout>
  );
}
