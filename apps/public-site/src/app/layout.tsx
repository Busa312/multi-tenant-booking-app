import type { ReactNode } from "react";
import { getPublicApiClient } from "@/lib/api";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const tenant = await getPublicApiClient().getTenant();

  return (
    <html lang="en">
      <head>
        <title>{tenant.name}</title>
      </head>
      <body>{children}</body>
    </html>
  );
}
