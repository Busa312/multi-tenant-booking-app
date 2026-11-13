import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { PreviewColorListener } from "@/components/PreviewColorListener";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SalonNotFoundDocument } from "@/components/SalonNotFoundDocument";
import { isLocale } from "@/i18n/locales";
import { localePath } from "@/lib/locale-path";
import { loadPageContextOrNull, resolveCopy } from "@/lib/page-context";
import { siteOrigin, sitePath } from "@/lib/site-url";
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

  return (
    // suppressHydrationWarning covers <html>'s own attributes only (not its
    // children): extensions such as dark-mode tools add attributes here, and
    // the tenant style below is identical on server and client anyway.
    <html lang={context.locale} style={tenantThemeStyle(tenantThemeVars(colors))} suppressHydrationWarning>
      <body>
        <PreviewColorListener />
        <div className="flex min-h-dvh flex-col">
          <header className="border-b-2 border-accent">
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3.5">
              <Link className="inline-flex min-w-0 items-center" href={context.href("/")}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="h-9 w-auto object-contain" src={logoUrl} alt={context.tenant.name} />
                ) : (
                  <span className="truncate text-xl font-extrabold tracking-tight">{context.tenant.name}</span>
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

          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-16 sm:pt-10">{children}</main>

          <footer className="border-t border-base-300">
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-base-content/65">
              <span className="truncate font-semibold text-base-content">{context.tenant.name}</span>
              <nav className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label={context.t("legal.footerNav")}>
                {/* R340 */}
                <Link className="link link-hover" href={context.href("/privacy")}>
                  {context.t("legal.privacyTitle")}
                </Link>
                <Link className="link link-hover" href={context.href("/terms")}>
                  {context.t("legal.termsTitle")}
                </Link>
                <Link className="link link-hover" href={context.href("/manage/resend")}>
                  {context.t("manage.findBooking")}
                </Link>
              </nav>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
