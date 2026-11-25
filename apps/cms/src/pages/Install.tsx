import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n, type Lang } from "../i18n/I18nContext.js";
import { AuthLayout } from "../components/AuthLayout.js";
import { IosInstallSteps } from "../components/IosInstallSteps.js";
import { SharePointer } from "../components/SharePointer.js";
import { Alert, Button, ButtonLink } from "../components/ui/index.js";
import { brandName } from "../lib/brand.js";
import { useInstallApp } from "../lib/useInstallApp.js";

const isLang = (value: string | null): value is Lang => value === "en" || value === "ka" || value === "ru";

/**
 * R620: "Get the app", linked from the marketing site. No sign-in needed. It
 * offers what this browser can do: its own install prompt (Chrome, Edge,
 * Android), the Add to Home Screen steps (iPhone, iPad), or where to look.
 */
export function InstallPage() {
  const { t, lang, setLang } = useI18n();
  const { way, installing, install } = useInstallApp();
  const [searchParams] = useSearchParams();
  const requestedLang = searchParams.get("lang");

  // The marketing page's language, passed along in the link
  useEffect(() => {
    if (isLang(requestedLang) && requestedLang !== lang) setLang(requestedLang);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedLang]);

  return (
    <AuthLayout
      headline={t("install.artHeadline")}
      artSub={t("install.artSub")}
      title={t("install.title")}
      subtitle={t("install.subtitle", { brand: brandName })}
    >
      {way === "installed" && (
        <>
          <Alert variant="success">{t("install.installed")}</Alert>
          <ButtonLink to="/" variant="primary" fullWidth>
            {t("install.continue")}
          </ButtonLink>
        </>
      )}

      {way === "prompt" && (
        <Button variant="primary" fullWidth icon="download" disabled={installing} onClick={install}>
          {t(installing ? "install.installing" : "install.installButton")}
        </Button>
      )}

      {way === "ios" && (
        <>
          <p className="mb-3">{t("install.iosIntro")}</p>
          <IosInstallSteps />
          <SharePointer />
        </>
      )}

      {way === "manual" && (
        <>
          <p className="mb-3">{t("install.manualIntro")}</p>
          <p className="text-sm text-base-content/60">{t("install.manualOther")}</p>
        </>
      )}

      {way !== "installed" && (
        <p className="mt-7 border-t border-base-300 pt-5 text-sm text-base-content/60">
          {t("install.forBusinesses", { brand: brandName })}
        </p>
      )}
    </AuthLayout>
  );
}
