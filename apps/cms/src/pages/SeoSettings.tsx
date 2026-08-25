import { useEffect, useState, type FormEvent } from "react";
import type { Tenant, TenantBusinessInfo, TenantSeo } from "@booking/shared-types";
import {
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  isValidHttpsUrl,
  isValidLatitude,
  isValidLongitude,
  isValidSeoString,
  resolveSeoDescription,
  resolveSeoTitle,
} from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { AppShell } from "../components/AppShell.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { SearchResultPreview } from "../components/SearchResultPreview.js";
import { Alert, Button, Card, Checkbox, Eyebrow, Field, TextInput, Textarea } from "../components/ui/index.js";
import styles from "./SeoSettings.module.css";

const PUBLIC_SITE_BASE_DOMAIN = import.meta.env.VITE_PUBLIC_SITE_BASE_DOMAIN as string | undefined;
const PUBLIC_SITE_PROTOCOL = (import.meta.env.VITE_PUBLIC_SITE_PROTOCOL as string | undefined) ?? "http";

const BUSINESS_FIELDS = [
  { key: "streetAddress", labelKey: "seo.fieldStreet" },
  { key: "city", labelKey: "seo.fieldCity" },
  { key: "region", labelKey: "seo.fieldRegion" },
  { key: "postalCode", labelKey: "seo.fieldPostalCode" },
  { key: "country", labelKey: "seo.fieldCountry" },
  { key: "telephone", labelKey: "seo.fieldTelephone" },
] as const;

type BusinessTextField = (typeof BUSINESS_FIELDS)[number]["key"];
type FieldKey = "title" | "description" | "ogImageUrl" | "coordinates";

/**
 * How the salon appears in search.
 *
 * The two things worth knowing about this screen:
 *
 * 1. The preview renders through the *shared* resolvers, so what it shows is
 *    literally what the public site's <head> will say — including the fallbacks
 *    that fill an empty form.
 * 2. The status line is not decoration. Indexability is computed rather than
 *    stored, so this is the only place a tenant can see whether they are
 *    actually listed — and the canonical URL shown there is the fastest way to
 *    catch a custom domain that was marked verified but never pointed at us.
 */
export function SeoSettingsPage() {
  const { t } = useI18n();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [seo, setSeo] = useState<TenantSeo>({});
  const [business, setBusiness] = useState<TenantBusinessInfo>({});
  // Kept as strings so a half-typed "-" or "41." doesn't get coerced to NaN
  // while the tenant is still typing.
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    cachedApi
      .getTenant()
      .then((tn) => {
        setTenant(tn);
        setSeo(tn.configJson.seo ?? {});
        setBusiness(tn.configJson.business ?? {});
        setLatitude(tn.configJson.business?.latitude?.toString() ?? "");
        setLongitude(tn.configJson.business?.longitude?.toString() ?? "");
      })
      .catch(() => setSaveError(t("seo.errLoad")));
    // Load once; a language switch shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function editSeo(patch: Partial<TenantSeo>, field?: FieldKey) {
    setSeo((prev) => ({ ...prev, ...patch }));
    if (field) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setSavedAt(null);
  }

  function editBusiness(field: BusinessTextField, value: string) {
    setBusiness((prev) => ({ ...prev, [field]: value }));
    setSavedAt(null);
  }

  function validate(): boolean {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (seo.title && !isValidSeoString(seo.title, SEO_TITLE_MAX)) {
      errors.title = "seo.errTitle";
    }
    if (seo.description && !isValidSeoString(seo.description, SEO_DESCRIPTION_MAX)) {
      errors.description = "seo.errDescription";
    }
    if (seo.ogImageUrl && !isValidHttpsUrl(seo.ogImageUrl)) {
      errors.ogImageUrl = "seo.errOgImageUrl";
    }
    // Both or neither — the API refuses half a pair, so catch it here with a
    // message rather than letting the save 400.
    if (Boolean(latitude.trim()) !== Boolean(longitude.trim())) {
      errors.coordinates = "seo.errCoordinatesPair";
    } else if (
      latitude.trim() &&
      // Mirrors the server's rule, including its rejection of exactly 0 — an
      // empty number input produces (0, 0), which is a point in the ocean.
      !(isValidLatitude(Number(latitude)) && isValidLongitude(Number(longitude)))
    ) {
      errors.coordinates = "seo.errCoordinatesNumber";
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
    const { latitude: _lat, longitude: _lng, ...withoutCoordinates } = business;
    try {
      const updated = await cachedApi.updateTenantSeo({
        // Sent complete: the endpoint replaces each sub-object, which is what
        // lets a cleared field actually clear.
        seo,
        business: {
          // Coordinates are stripped and re-added rather than spread through:
          // `business` still holds whatever was loaded, so emptying both inputs
          // would otherwise re-send the old pair and make them unclearable.
          ...withoutCoordinates,
          ...(latitude.trim() && longitude.trim()
            ? { latitude: Number(latitude), longitude: Number(longitude) }
            : {}),
        },
      });
      setTenant(updated);
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(t(err instanceof ApiError ? "seo.errRejected" : "seo.errSave"));
    } finally {
      setSaving(false);
    }
  }

  if (!tenant) {
    return (
      <AppShell title={t("seo.title")} subtitle={t("seo.subtitle")}>
        <CardSkeleton rows={8} rowHeight="52px" />
      </AppShell>
    );
  }

  // Previewed against the draft, not the saved tenant, so the fallbacks update
  // as the tenant types.
  const draftTenant: Tenant = { ...tenant, configJson: { ...tenant.configJson, seo } };
  const previewTitle = resolveSeoTitle(draftTenant);
  const previewDescription = resolveSeoDescription(draftTenant);
  const canonicalHost =
    tenant.customDomain && tenant.domainVerifiedAt
      ? tenant.customDomain
      : PUBLIC_SITE_BASE_DOMAIN
        ? `${tenant.subdomain}.${PUBLIC_SITE_BASE_DOMAIN}`
        : null;
  const canonicalUrl = canonicalHost ? `${PUBLIC_SITE_PROTOCOL}://${canonicalHost}` : null;
  // Mirrors isIndexable's rule. `hasActiveServices` isn't known here, so the
  // "no description" half is what this can speak to — which is also the half a
  // tenant can fix from this page.
  const hidden = seo.noindex === true;
  // `||` not `??` — the draft holds "" the moment the field is cleared.
  const hasDescription = Boolean(seo.description || tenant.configJson.copy?.tagline);

  return (
    <AppShell title={t("seo.title")} subtitle={t("seo.subtitle")} tenantSubdomain={tenant.subdomain}>
      <div className={`fade-up ${styles.layout}`}>
        <Card as="form" onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.status} role="status">
            {hidden ? (
              <span className={styles.hidden}>{t("seo.statusHidden")}</span>
            ) : hasDescription ? (
              <span className={styles.indexed}>{t("seo.statusIndexed")}</span>
            ) : (
              <span className={styles.pending}>{t("seo.statusNeedsDescription")}</span>
            )}
            {canonicalUrl && (
              // Clickable on purpose: a custom domain marked verified but never
              // pointed at us would otherwise canonicalise every page to a dead
              // hostname, and nothing else in the product would ever say so.
              <a className={styles.canonical} href={canonicalUrl} target="_blank" rel="noreferrer">
                {canonicalUrl}
              </a>
            )}
          </div>

          <Eyebrow>{t("seo.sectionListing")}</Eyebrow>

          <Field
            label={
              <span className={styles.labelRow}>
                {t("seo.fieldTitle")}
                <span className={styles.counter}>
                  {(seo.title ?? "").length}/{SEO_TITLE_MAX}
                </span>
              </span>
            }
            htmlFor="seo-title"
          >
            <TextInput
              id="seo-title"
              value={seo.title ?? ""}
              maxLength={SEO_TITLE_MAX}
              placeholder={resolveSeoTitle({ ...tenant, configJson: { ...tenant.configJson, seo: {} } })}
              onChange={(e) => editSeo({ title: e.target.value }, "title")}
            />
            {fieldErrors.title && <Alert className={styles.fieldError}>{t(fieldErrors.title)}</Alert>}
          </Field>

          <Field
            label={
              <span className={styles.labelRow}>
                {t("seo.fieldDescription")}
                <span className={styles.counter}>
                  {(seo.description ?? "").length}/{SEO_DESCRIPTION_MAX}
                </span>
              </span>
            }
            htmlFor="seo-description"
          >
            <Textarea
              id="seo-description"
              rows={3}
              value={seo.description ?? ""}
              maxLength={SEO_DESCRIPTION_MAX}
              placeholder={t("seo.descriptionPlaceholder")}
              onChange={(e) => editSeo({ description: e.target.value }, "description")}
            />
            {fieldErrors.description && <Alert className={styles.fieldError}>{t(fieldErrors.description)}</Alert>}
          </Field>

          <Field label={t("seo.fieldOgImage")} htmlFor="seo-og-image">
            <TextInput
              id="seo-og-image"
              type="url"
              value={seo.ogImageUrl ?? ""}
              placeholder="https://…"
              onChange={(e) => editSeo({ ogImageUrl: e.target.value }, "ogImageUrl")}
            />
            <p className={styles.hint}>{t("seo.ogImageHint")}</p>
            {fieldErrors.ogImageUrl && <Alert className={styles.fieldError}>{t(fieldErrors.ogImageUrl)}</Alert>}
          </Field>

          <Eyebrow>{t("seo.sectionBusiness")}</Eyebrow>
          <p className={styles.hint}>{t("seo.businessHint")}</p>

          <div className={styles.addressGrid}>
            {BUSINESS_FIELDS.map(({ key, labelKey }) => (
              <Field label={t(labelKey)} htmlFor={`seo-${key}`} key={key}>
                <TextInput
                  id={`seo-${key}`}
                  value={business[key] ?? ""}
                  onChange={(e) => editBusiness(key, e.target.value)}
                />
              </Field>
            ))}
            <Field label={t("seo.fieldLatitude")} htmlFor="seo-latitude">
              <TextInput
                id="seo-latitude"
                inputMode="decimal"
                value={latitude}
                placeholder="41.7151"
                onChange={(e) => {
                  setLatitude(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, coordinates: undefined }));
                  setSavedAt(null);
                }}
              />
            </Field>
            <Field label={t("seo.fieldLongitude")} htmlFor="seo-longitude">
              <TextInput
                id="seo-longitude"
                inputMode="decimal"
                value={longitude}
                placeholder="44.8271"
                onChange={(e) => {
                  setLongitude(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, coordinates: undefined }));
                  setSavedAt(null);
                }}
              />
            </Field>
          </div>
          {fieldErrors.coordinates && <Alert className={styles.fieldError}>{t(fieldErrors.coordinates)}</Alert>}

          <Eyebrow>{t("seo.sectionVisibility")}</Eyebrow>
          <Checkbox checked={seo.noindex === true} onChange={(checked) => editSeo({ noindex: checked })}>
            {t("seo.noindexLabel")}
          </Checkbox>
          <p className={styles.hint}>{t("seo.noindexHint")}</p>

          {saveError && <Alert>{saveError}</Alert>}
          {savedAt && <Alert variant="success">{t("seo.saved")}</Alert>}

          <Button type="submit" fullWidth disabled={saving} className={styles.saveBtn}>
            {saving ? t("common.saving") : t("seo.saveBtn")}
          </Button>
        </Card>

        <div className={styles.previewPanel}>
          <Eyebrow>{t("seo.previewTitle")}</Eyebrow>
          <SearchResultPreview
            title={previewTitle}
            description={previewDescription}
            url={canonicalUrl ?? t("seo.previewUrlUnknown")}
          />
          <p className={styles.hint}>{t("seo.previewHint")}</p>
        </div>
      </div>
    </AppShell>
  );
}
