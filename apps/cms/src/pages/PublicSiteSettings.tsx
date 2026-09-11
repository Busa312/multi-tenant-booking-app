import { useEffect, useState, type FormEvent } from "react";
import type { LocalizedText } from "@booking/shared-types";
import { SUPPORTED_CONTENT_LOCALES, enabledLocalesOf } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { AppShell } from "../components/AppShell.js";
import { LocalizedField } from "../components/LocalizedField.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { Alert, Button, Checkbox, Eyebrow } from "../components/ui/index.js";
import styles from "./PublicSiteSettings.module.css";

// R170: the title and description shown on the public site

interface PageData {
  title: string;
  titleI18n: LocalizedText;
  description: string;
  descriptionI18n: LocalizedText;
  enabledLocales: string[];
}

export function PublicSiteSettingsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function load() {
    cachedApi
      .getTenant()
      .then((tenant) => {
        const copy = tenant.configJson.copy ?? {};
        setData({
          title: copy.title ?? "",
          titleI18n: copy.titleI18n ?? {},
          description: copy.description ?? "",
          descriptionI18n: copy.descriptionI18n ?? {},
          enabledLocales: enabledLocalesOf(tenant.configJson.enabledLocales),
        });
      })
      .catch(() => setError(t("publicSite.errLoad")));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  function patch(changes: Partial<PageData>) {
    setSaved(false);
    setData((current) => (current ? { ...current, ...changes } : current));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setError(null);
    setSaving(true);
    try {
      await cachedApi.updateTenantLocales({ enabledLocales: data.enabledLocales });
      await cachedApi.updateTenantCopy({
        title: data.title.trim(),
        titleI18n: data.titleI18n,
        description: data.description.trim(),
        descriptionI18n: data.descriptionI18n,
      });
      setSaved(true);
    } catch {
      setError(t("publicSite.errSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title={t("publicSite.title")} subtitle={t("publicSite.subtitle")}>
      <div className="fade-up">
        {error && <Alert>{error}</Alert>}
        {!data && <CardSkeleton rows={2} rowHeight="86px" />}

        {data && (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <Eyebrow>{t("publicSite.languagesTitle")}</Eyebrow>
            <p className={styles.hint}>{t("publicSite.languagesHint")}</p>
            <div className={styles.languages}>
              {SUPPORTED_CONTENT_LOCALES.map((locale) => {
                const isDefault = locale === data.enabledLocales[0];
                return (
                  <Checkbox
                    key={locale}
                    checked={data.enabledLocales.includes(locale)}
                    // The default locale is what every plain column holds, so
                    // turning it off would relabel stored text as a language it
                    // isn't written in. Locked rather than silently rejected.
                    disabled={isDefault}
                    onChange={() =>
                      patch({
                        enabledLocales: data.enabledLocales.includes(locale)
                          ? data.enabledLocales.filter((l) => l !== locale)
                          : [...data.enabledLocales, locale],
                      })
                    }
                  >
                    {t(`publicSite.language.${locale}`)}
                    {isDefault && ` — ${t("publicSite.languageMain")}`}
                  </Checkbox>
                );
              })}
            </div>

            <LocalizedField
              id="public-title"
              label={t("publicSite.titleLabel")}
              locales={data.enabledLocales}
              value={data.title}
              onChange={(title) => patch({ title })}
              i18n={data.titleI18n}
              onI18nChange={(titleI18n) => patch({ titleI18n })}
              placeholder={t("publicSite.titlePlaceholder")}
            />
            <p className={styles.hint}>{t("publicSite.titleHint")}</p>

            <LocalizedField
              id="public-description"
              label={t("publicSite.descriptionLabel")}
              locales={data.enabledLocales}
              value={data.description}
              onChange={(description) => patch({ description })}
              i18n={data.descriptionI18n}
              onI18nChange={(descriptionI18n) => patch({ descriptionI18n })}
              placeholder={t("publicSite.descriptionPlaceholder")}
              multiline
            />
            <p className={styles.hint}>{t("publicSite.descriptionHint")}</p>

            <div className={styles.actions}>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
              {saved && <span className={styles.saved}>{t("publicSite.saved")}</span>}
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
