import { redirect } from "next/navigation";
import { loadPageContext } from "@/lib/page-context";

export const dynamic = "force-dynamic";

/**
 * R610: the short form of a booking link, used in reminder texts so they fit
 * one SMS part. It only forwards to the manage page, in the salon's main
 * language (or the one in front of `/m`). The link is a credential: never
 * indexed (robots and no sitemap entry, like `/manage`).
 */
export default async function ShortManageLink({ params }: { params: { locale: string; token: string } }) {
  const context = await loadPageContext(params.locale);
  redirect(context.href(`/manage/${encodeURIComponent(params.token)}`));
}
