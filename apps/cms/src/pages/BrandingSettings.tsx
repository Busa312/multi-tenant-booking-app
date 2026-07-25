import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Tenant, TenantColors } from "@booking/shared-types";
import { DEFAULT_TENANT_COLORS, isValidColor, meetsWcagAA } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { cmsApiClient } from "../lib/api.js";
import { AppShell } from "../components/AppShell.js";

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
  const previewHost = previewOrigin?.replace(/^https?:\/\//, "");

  return (
    <AppShell
      title="Public website"
      subtitle="Style the site your clients book from"
      tenantSubdomain={tenant?.subdomain}
    >
      {!tenant && <p>Loading…</p>}
      {tenant && (
        <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "22px", alignItems: "start" }}>
          <form onSubmit={handleSubmit} className="card" style={{ position: "sticky", top: "90px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "3px" }}>Public site style</div>
            <div style={{ fontSize: "12.5px", color: "var(--ink-soft)", marginBottom: "20px" }}>
              {previewHost ? `Changes preview live at ${previewHost}` : "Colors apply to your public booking site"}
            </div>

            <div className="eyebrow">Colors</div>
            <div style={{ marginBottom: "22px" }}>
              {FIELDS.map(({ key, label }) => (
                <div className="field" key={key}>
                  <label className="field-label">{label}</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="color"
                      value={isValidColor(colors[key]) && HEX_ONLY.test(colors[key]) ? colors[key] : "#000000"}
                      onChange={(e) => handleChange(key, e.target.value)}
                      style={{
                        width: "44px",
                        height: "40px",
                        flex: "none",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        background: "none",
                        padding: "2px",
                        cursor: "pointer",
                      }}
                    />
                    <input
                      type="text"
                      className="input"
                      value={colors[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={DEFAULT_TENANT_COLORS[key]}
                    />
                  </div>
                  {fieldErrors[key] && (
                    <p className="alert alert-error" role="alert" style={{ marginTop: "6px", marginBottom: 0 }}>
                      {fieldErrors[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {!contrastRatioOk && (
              <p className="alert alert-warning" role="status">
                The selected text/background combination doesn&apos;t meet WCAG AA contrast. You can still save, but
                some visitors may have trouble reading the site.
              </p>
            )}
            {saveError && (
              <p className="alert alert-error" role="alert">
                {saveError}
              </p>
            )}
            {savedAt && (
              <p className="alert alert-success" role="status">
                Saved.
              </p>
            )}

            <button type="submit" className="btn btn-primary btn-full" disabled={saving || resetting}>
              {saving ? "Saving…" : "Save colors"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={handleReset}
              disabled={saving || resetting}
              style={{ marginTop: "10px" }}
            >
              {resetting ? "Resetting…" : "Reset to default"}
            </button>
          </form>

          {previewOrigin ? (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "16px",
                overflow: "hidden",
                background: "var(--surface)",
                boxShadow: "0 18px 40px -24px rgba(43, 38, 32, .4)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "9px 14px",
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#e3ccc4" }} />
                <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#e6dcc4" }} />
                <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#cfe0cf" }} />
                <div
                  style={{
                    marginLeft: "10px",
                    fontSize: "12px",
                    color: "var(--ink-soft)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span className="ms" style={{ fontSize: "14px" }}>
                    lock
                  </span>
                  {previewHost}
                </div>
              </div>
              <iframe
                ref={iframeRef}
                key={previewOrigin}
                src={previewOrigin}
                title="Public site preview"
                onLoad={() => setPreviewReady(true)}
                style={{ width: "100%", height: "620px", border: "none", display: "block" }}
              />
            </div>
          ) : (
            <p className="alert alert-error" role="alert">
              Preview unavailable — VITE_PUBLIC_SITE_BASE_DOMAIN is not configured.
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}

const HEX_ONLY = /^#([0-9a-f]{6})$/i;
