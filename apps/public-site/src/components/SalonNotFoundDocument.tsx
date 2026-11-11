import type { ReactNode } from "react";
import { DEFAULT_TENANT_COLORS } from "@booking/shared-types";
import { tenantThemeStyle, tenantThemeVars } from "@/lib/tenant-theme";

interface SalonNotFoundDocumentProps {
  lang: string;
  children: ReactNode;
}

/**
 * The document for a host no salon owns, standing in for the salon layout.
 * It still renders the page, which calls notFound(): that is what sets the
 * 404 status, and app/[locale]/not-found.tsx then draws the message in here.
 * With no salon to theme it, it uses the platform's default colors, through
 * the same tenantThemeVars as a real salon page.
 */
export function SalonNotFoundDocument({ lang, children }: SalonNotFoundDocumentProps) {
  return (
    <html lang={lang} style={tenantThemeStyle(tenantThemeVars(DEFAULT_TENANT_COLORS))} suppressHydrationWarning>
      <body>
        <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4">{children}</main>
      </body>
    </html>
  );
}
