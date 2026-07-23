import type { ReactNode } from "react";
import { headers } from "next/headers";
import { getCachedTenant, resolveTenantColors } from "@/lib/tenant-config";
import { PreviewColorListener } from "@/components/PreviewColorListener";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const host = headers().get("host") ?? "";
  const tenant = await getCachedTenant(host);
  const colors = resolveTenantColors(tenant);

  return (
    <html lang="en">
      <head>
        <title>{tenant.name}</title>
        <style>{`:root {
  --color-primary: ${colors.primary};
  --color-secondary: ${colors.secondary};
  --color-background: ${colors.background};
  --color-text: ${colors.text};
}`}</style>
      </head>
      <body style={{ backgroundColor: "var(--color-background)", color: "var(--color-text)" }}>
        <PreviewColorListener />
        {children}
      </body>
    </html>
  );
}
