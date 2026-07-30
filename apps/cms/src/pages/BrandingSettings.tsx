import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Tenant, TenantColors } from "@booking/shared-types";
import { DEFAULT_TENANT_COLORS, isValidColor, meetsWcagAA } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { AppShell } from "../components/AppShell.js";
import { Alert, Button, Card, Eyebrow, Field, Icon, TextInput } from "../components/ui/index.js";
import styles from "./BrandingSettings.module.css";

type ColorField = keyof TenantColors;

const FIELDS: { key: ColorField; labelKey: string }[] = [
  { key: "primary", labelKey: "branding.fieldPrimary" },
  { key: "secondary", labelKey: "branding.fieldSecondary" },
  { key: "background", labelKey: "branding.fieldBackground" },
  { key: "text", labelKey: "branding.fieldText" },
];

// Must match apps/public-site's PreviewColorListener MESSAGE_TYPE constant.
const PREVIEW_MESSAGE_TYPE = "booking:preview-colors";

const PUBLIC_SITE_BASE_DOMAIN = import.meta.env.VITE_PUBLIC_SITE_BASE_DOMAIN as string | undefined;
const PUBLIC_SITE_PROTOCOL = (import.meta.env.VITE_PUBLIC_SITE_PROTOCOL as string | undefined) ?? "http";

export function BrandingSettingsPage() {
  const { t } = useI18n();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [colors, setColors] = useState<Required<TenantColors>>(DEFAULT_TENANT_COLORS);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ColorField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    cachedApi.getTenant().then((tn) => {
      setTenant(tn);
      setColors({ ...DEFAULT_TENANT_COLORS, ...tn.configJson.colors });
    });
  }, []);

  const previewOrigin =
    tenant && PUBLIC_SITE_BASE_DOMAIN ? `${PUBLIC_SITE_PROTOCOL}://${tenant.subdomain}.${PUBLIC_SITE_BASE_DOMAIN}` : null;

  // Live, unsaved-edit preview (R80): postMessage draft colors into the
  // embedded public site on every change — no save/revalidation round-trip.
  // The receiving end (PreviewColorListener) validates event.origin itself.
  useEffect(() => {
    if (!previewReady || !previewOrigin) {
      return;
    }
    iframeRef.current?.contentWindow?.postMessage({ type: PREVIEW_MESSAGE_TYPE, colors }, previewOrigin);
  }, [colors, previewReady, previewOrigin]);

  function handleChange(field: ColorField, value: string) {
    setColors((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setSavedAt(null);
  }

  function validate(): boolean {
    const errors: Partial<Record<ColorField, string>> = {};
    for (const { key, labelKey } of FIELDS) {
      if (!isValidColor(colors[key])) {
        errors[key] = t("branding.invalidColor", { label: t(labelKey) });
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSavedAt(null);

    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      const updated = await cachedApi.updateTenantColors(colors);
      setTenant(updated);
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(t(err instanceof ApiError ? "branding.errRejected" : "branding.errSave"));
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm(t("branding.confirmReset"))) {
      return;
    }

    setSaveError(null);
    setResetting(true);
    try {
      const updated = await cachedApi.resetTenantColors();
      setTenant(updated);
      setColors({ ...DEFAULT_TENANT_COLORS, ...updated.configJson.colors });
      setFieldErrors({});
      setSavedAt(Date.now());
    } catch {
      setSaveError(t("branding.errReset"));
    } finally {
      setResetting(false);
    }
  }

  const contrastRatioOk = meetsWcagAA(colors.text, colors.background);
  const previewHost = previewOrigin?.replace(/^https?:\/\//, "");

  return (
    <AppShell title={t("branding.title")} subtitle={t("branding.subtitle")} tenantSubdomain={tenant?.subdomain}>
      {!tenant && <p>{t("common.loading")}</p>}
      {tenant && (
        <div className={`fade-up ${styles.layout}`}>
          <Card as="form" onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formTitle}>{t("branding.formTitle")}</div>
            <div className={styles.formSub}>
              {previewHost ? t("branding.formSubLive", { host: previewHost }) : t("branding.formSubStatic")}
            </div>

            <Eyebrow>{t("branding.colors")}</Eyebrow>
            <div className={styles.colors}>
              {FIELDS.map(({ key, labelKey }) => (
                <Field label={t(labelKey)} key={key}>
                  <div className={styles.colorRow}>
                    <input
                      type="color"
                      className={styles.swatch}
                      value={isValidColor(colors[key]) && HEX_ONLY.test(colors[key]) ? colors[key] : "#000000"}
                      onChange={(e) => handleChange(key, e.target.value)}
                    />
                    <TextInput
                      type="text"
                      value={colors[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={DEFAULT_TENANT_COLORS[key]}
                    />
                  </div>
                  {fieldErrors[key] && <Alert className={styles.fieldError}>{fieldErrors[key]}</Alert>}
                </Field>
              ))}
            </div>

            {!contrastRatioOk && <Alert variant="warning">{t("branding.wcagWarning")}</Alert>}
            {saveError && <Alert>{saveError}</Alert>}
            {savedAt && <Alert variant="success">{t("branding.saved")}</Alert>}

            <Button type="submit" fullWidth disabled={saving || resetting}>
              {saving ? t("common.saving") : t("branding.saveBtn")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={handleReset}
              disabled={saving || resetting}
              className={styles.resetBtn}
            >
              {resetting ? t("branding.resetting") : t("branding.resetBtn")}
            </Button>
          </Card>

          {previewOrigin ? (
            <div className={styles.preview}>
              <div className={styles.chrome}>
                <span className={`${styles.dot} ${styles.dot1}`} />
                <span className={`${styles.dot} ${styles.dot2}`} />
                <span className={`${styles.dot} ${styles.dot3}`} />
                <div className={styles.url}>
                  <Icon name="lock" size={14} />
                  {previewHost}
                </div>
              </div>
              <iframe
                ref={iframeRef}
                key={previewOrigin}
                src={previewOrigin}
                title={t("branding.previewTitle")}
                onLoad={() => setPreviewReady(true)}
                className={styles.iframe}
              />
            </div>
          ) : (
            <Alert>{t("branding.previewUnavailable")}</Alert>
          )}
        </div>
      )}
    </AppShell>
  );
}

const HEX_ONLY = /^#([0-9a-f]{6})$/i;
