import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { PreviewColorListener } from "@/components/PreviewColorListener";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { loadPageContext, resolveCopy } from "@/lib/page-context";
import { resolveTenantColors } from "@/lib/tenant-config";
import { tenantThemeStyle, tenantThemeVars } from "@/lib/tenant-theme";
import "../theme.css";

interface LayoutProps {
  children: ReactNode;
  params: { locale: string };
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const context = await loadPageContext(params.locale);
  const { title, description } = resolveCopy(context);
  // R170: the tenant's own title and description

  return { title, description };
}

export default async function RootLayout({ children, params }: LayoutProps) {
  const context = await loadPageContext(params.locale);
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
          <header className="sticky top-0 z-20 border-b border-base-300 bg-base-100/85 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
              <Link className="inline-flex min-w-0 items-center" href="/">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="h-9 w-auto object-contain" src={logoUrl} alt={context.tenant.name} />
                ) : (
                  <span className="truncate text-lg font-bold tracking-tight">{context.tenant.name}</span>
                )}
              </Link>
              <LanguageSwitcher
                current={context.locale}
                enabledLocales={context.tenant.configJson.enabledLocales}
                label={context.t("nav.language")}
              />
            </div>
          </header>

          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-12 sm:pt-10">{children}</main>

          <footer className="border-t border-base-300">
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-base-content/60">
              <span className="truncate">{context.tenant.name}</span>
              <Link className="link link-hover" href="/manage/resend">
                {context.t("manage.lostLink")}
              </Link>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
