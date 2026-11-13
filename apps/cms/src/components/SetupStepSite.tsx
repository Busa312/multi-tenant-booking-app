import { useI18n } from "../i18n/I18nContext.js";
import { ButtonLink } from "./ui/index.js";

interface SetupStepSiteProps {
  siteUrl: string | null;
}

/**
 * R420 step 5: how the booking site looks and reads. The defaults work, so
 * this is the step most salons can skip; it points at the two settings pages
 * rather than repeating them.
 */
export function SetupStepSite({ siteUrl }: SetupStepSiteProps) {
  const { t } = useI18n();

  return (
    <>
      <p className="text-base-content/70">{t("setup.siteIntro")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink to="/settings/colors" variant="secondary" icon="palette">
          {t("setup.siteColors")}
        </ButtonLink>
        <ButtonLink to="/settings/public-site" variant="secondary" icon="edit_note">
          {t("setup.siteText")}
        </ButtonLink>
      </div>
      {siteUrl && (
        <p className="mt-4 text-sm">
          <a className="link" href={siteUrl} target="_blank" rel="noopener noreferrer">
            {t("setup.sitePreview")} <span aria-hidden="true">↗</span>
          </a>
        </p>
      )}
    </>
  );
}
