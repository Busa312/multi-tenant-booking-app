import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Tenant, TenantColors } from "@booking/shared-types";
import { DEFAULT_TENANT_COLORS, isValidColor, meetsWcagAA } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { cmsApiClient } from "../lib/api.js";

type ColorField = keyof TenantColors;

const FIELDS: { key: ColorField; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary / Accent" },
  { key: "background", label: "Background" },
  { key: "text", label: "Text" },
];

// Must match apps/public-site's PreviewColorListener MESSAGE_TYPE constant.
const PREVIEW_MESSAGE_TYPE = "booking:preview-colors";

const PUBLIC_SITE_BASE_DOMAIN = import.meta.env.VITE_PUBLIC_SITE_BASE_DOMAIN as string | undefined;
const PUBLIC_SITE_PROTOCOL = (import.meta.env.VITE_PUBLIC_SITE_PROTOCOL as string | undefined) ?? "http";

export function BrandingSettingsPage() {
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
    cmsApiClient.getTenant().then((t) => {
      setTenant(t);
      setColors({ ...DEFAULT_TENANT_COLORS, ...t.configJson.colors });
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
    for (const { key, label } of FIELDS) {
      if (!isValidColor(colors[key])) {
        errors[key] = `${label} must be a valid hex (#rrggbb) or rgb(r, g, b) value`;
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
      const updated = await cmsApiClient.updateTenantColors(colors);
      setTenant(updated);
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? "One or more color values were rejected" : "Something went wrong saving colors",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("Reset colors to the platform default palette? This can't be undone.")) {
      return;
    }

    setSaveError(null);
    setResetting(true);
    try {
      const updated = await cmsApiClient.resetTenantColors();
      setTenant(updated);
      setColors({ ...DEFAULT_TENANT_COLORS, ...updated.configJson.colors });
      setFieldErrors({});
      setSavedAt(Date.now());
    } catch {
      setSaveError("Something went wrong resetting colors");
    } finally {
      setResetting(false);
    }
  }

  const contrastRatioOk = meetsWcagAA(colors.text, colors.background);

  return (
    <div>
      <p>
        <Link to="/">← Back to dashboard</Link>
      </p>
      <h1>Public site colors</h1>
      {!tenant && <p>Loading…</p>}
      {tenant && (
        <form onSubmit={handleSubmit}>
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label>
                {label}
                <input
                  type="color"
                  value={isValidColor(colors[key]) && HEX_ONLY.test(colors[key]) ? colors[key] : "#000000"}
                  onChange={(e) => handleChange(key, e.target.value)}
                />
                <input
                  type="text"
                  value={colors[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={DEFAULT_TENANT_COLORS[key]}
                />
              </label>
              {fieldErrors[key] && <p role="alert">{fieldErrors[key]}</p>}
            </div>
          ))}

          {!contrastRatioOk && (
            <p role="status">
              Warning: the selected text/background combination doesn&apos;t meet WCAG AA contrast. You can still
              save, but some visitors may have trouble reading the site.
            </p>
          )}

          {saveError && <p role="alert">{saveError}</p>}
          {savedAt && <p role="status">Saved.</p>}

          <div style={{ marginTop: "1rem" }}>
            <button type="submit" disabled={saving || resetting}>
              {saving ? "Saving…" : "Save colors"}
            </button>
            <button type="button" onClick={handleReset} disabled={saving || resetting}>
              {resetting ? "Resetting…" : "Reset to default"}
            </button>
          </div>
        </form>
      )}

      {tenant && (
        <section aria-label="Live preview" style={{ marginTop: "1.5rem" }}>
          <p>
            Live preview — <code>{tenant.subdomain}</code> (updates as you edit, before saving)
          </p>
          {previewOrigin ? (
            <iframe
              ref={iframeRef}
              key={previewOrigin}
              src={previewOrigin}
              title="Public site preview"
              onLoad={() => setPreviewReady(true)}
              style={{ width: "100%", height: "480px", border: "1px solid #ccc" }}
            />
          ) : (
            <p role="alert">Preview unavailable — VITE_PUBLIC_SITE_BASE_DOMAIN is not configured.</p>
          )}
        </section>
      )}
    </div>
  );
}

const HEX_ONLY = /^#([0-9a-f]{6})$/i;
