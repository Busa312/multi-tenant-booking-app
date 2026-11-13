import type { Metadata } from "next";
import { getMessages } from "@/i18n/locales";
import { loadPageContext } from "@/lib/page-context";
import { ResendLinkForm } from "@/components/ResendLinkForm";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const context = await loadPageContext(params.locale);
  return { title: context.t("manage.resend.heading"), robots: { index: false, follow: false } };
}

export default async function ResendPage({ params }: { params: { locale: string } }) {
  const context = await loadPageContext(params.locale);
  return <ResendLinkForm messages={getMessages(context.locale)} />;
}
