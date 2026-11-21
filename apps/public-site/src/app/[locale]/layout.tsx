import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { BookingProgressReset } from "@/components/BookingProgressReset";
import { PreviewColorListener } from "@/components/PreviewColorListener";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PoweredBy } from "@/components/PoweredBy";
import { SalonNotFoundDocument } from "@/components/SalonNotFoundDocument";
import { isLocale } from "@/i18n/locales";
import { localePath } from "@/lib/locale-path";
import { loadPageContextOrNull, resolveCopy } from "@/lib/page-context";
import { siteOrigin, sitePath } from "@/lib/site-url";
import { isEmbedPath } from "@/lib/embed";
import { resolveTenantColors } from "@/lib/tenant-config";
import { tenantThemeStyle, tenantThemeVars } from "@/lib/tenant-theme";
import "../theme.css";

interface LayoutProps {
  children: ReactNode;
  params: { locale: string };
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const context = await loadPageContextOrNull(params.locale);
  if (!context) {
    return { title: "404", robots: { index: false } };
  }
  const { title, description } = resolveCopy(context);
  const origin = siteOrigin();
  // The page's own path; the query never belongs in a canonical URL.
  const path = sitePath().split("?")[0] || "/";
  const url = (locale: string) => `${origin}${localePath(locale, context.defaultLocale, path)}`;
  const published = (context.tenant.configJson.enabledLocales ?? []).filter(isLocale);

  return {
    metadataBase: new URL(origin),
    // R170: the tenant's own title and description. A page that names itself
    // ("Book an appointment") gets the salon's name after it.
    title: { default: title, template: `%s · ${context.tenant.name}` },
    description,
    icons: { icon: [{ url: "/tenant-icon.svg", type: "image/svg+xml" }] },
    // R160: one URL per language, each pointing at the others
    alternates: {
      canonical: url(context.locale),
      languages:
        published.length > 1
          ? { ...Object.fromEntries(published.map((locale) => [locale, url(locale)])), "x-default": url(context.defaultLocale) }
          : undefined,
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps) {
  const context = await loadPageContextOrNull(params.locale);
  if (!context) {
    // No salon owns this host. The page still renders and calls notFound(),
    // which sets the 404 status and shows not-found.tsx inside this shell.
    return <SalonNotFoundDocument lang={params.locale}>{children}</SalonNotFoundDocument>;
  }
  // resolveTenantColors re-validates every saved value with isValidColor
  // (injection guard); tenantThemeStyle only adds constants and checks again.
  const colors = resolveTenantColors(context.tenant);
  const logoUrl = context.tenant.configJson.logoUrl;

  // R410: a page framed by a salon's own website brings no header or footer of
  // its own — the host page is the chrome. Same palette, same language.
  if (isEmbedPath(sitePath())) {
    return (
      <html lang={context.locale} style={tenantThemeStyle(tenantThemeVars(colors))} suppressHydrationWarning>
        <body>{children}</body>
      </html>
    );
  }

  return (
    // suppressHydrationWarning covers <html>'s own attributes only (not its
    // children): extensions such as dark-mode tools add attributes here, and
    // the tenant style below is identical on server and client anyway.
    <html lang={context.locale} style={tenantThemeStyle(tenantThemeVars(colors))} suppressHydrationWarning>
      <body>
        <PreviewColorListener />
        <BookingProgressReset />
        <div className="flex min-h-dvh flex-col">
          {/* Translucent and sticky, like a product page's bar: the salon's name and the languages stay in reach. */}
          <header className="sticky top-0 z-30 border-b border-base-300/60 bg-base-100/75 backdrop-blur-xl backdrop-saturate-150">
            <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4">
              <Link className="inline-flex min-w-0 items-center" href={context.href("/")}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="h-8 w-auto object-contain" src={logoUrl} alt={context.tenant.name} />
                ) : (
                  <span className="truncate text-lg font-semibold tracking-tight">{context.tenant.name}</span>
                )}
              </Link>
              <LanguageSwitcher
                current={context.locale}
                defaultLocale={context.defaultLocale}
                enabledLocales={context.tenant.configJson.enabledLocales}
                label={context.t("nav.language")}
              />
            </div>
          </header>

          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-24 sm:pt-16">{children}</main>

          <footer className="bg-base-200 text-xs text-base-content/65">
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-6 pb-4">
              <span className="truncate font-semibold text-base-content/80">{context.tenant.name}</span>
              <nav className="flex flex-wrap items-center gap-x-5 gap-y-1" aria-label={context.t("legal.footerNav")}>
                {/* R340 */}
                <Link className="hover:text-base-content hover:underline" href={context.href("/privacy")}>
                  {context.t("legal.privacyTitle")}
                </Link>
                <Link className="hover:text-base-content hover:underline" href={context.href("/terms")}>
                  {context.t("legal.termsTitle")}
                </Link>
                <Link className="hover:text-base-content hover:underline" href={context.href("/manage/resend")}>
                  {context.t("manage.findBooking")}
                </Link>
              </nav>
            </div>
            <PoweredBy locale={context.locale} t={context.t} />
          </footer>
        </div>
      </body>
    </html>
  );
}
