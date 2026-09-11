import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PreviewColorListener } from "@/components/PreviewColorListener";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { loadPageContext, resolveCopy } from "@/lib/page-context";
import { resolveTenantColors } from "@/lib/tenant-config";
import "../theme.css";
import styles from "./layout.module.css";

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
  const colors = resolveTenantColors(context.tenant);

  return (
    <html lang={context.locale}>
      <head>
        <style>{`:root {
  --color-primary: ${colors.primary};
  --color-secondary: ${colors.secondary};
  --color-background: ${colors.background};
  --color-text: ${colors.text};
}`}</style>
      </head>
      <body>
        <PreviewColorListener />
        <div className={styles.shell}>
          <header className={styles.header}>
            <a className={styles.brand} href="/">
              {context.tenant.configJson.logoUrl ? (

                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.logo} src={context.tenant.configJson.logoUrl} alt={context.tenant.name} />
              ) : (
                <span className={styles.brandName}>{context.tenant.name}</span>
              )}
            </a>
            <LanguageSwitcher
              current={context.locale}
              enabledLocales={context.tenant.configJson.enabledLocales}
              label={context.t("nav.language")}
            />
          </header>
          <main className={styles.main}>{children}</main>
        </div>
      </body>
    </html>
  );
}
