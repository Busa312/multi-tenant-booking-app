import type { Metadata } from "next";
import { getMessages } from "@/i18n/locales";
import { loadPageContext } from "@/lib/page-context";
import { ResendLinkForm } from "@/components/ResendLinkForm";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ResendPage({ params }: { params: { locale: string } }) {
  const context = await loadPageContext(params.locale);
  return <ResendLinkForm messages={getMessages(context.locale)} />;
}
