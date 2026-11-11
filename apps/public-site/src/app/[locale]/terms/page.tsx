import type { Metadata } from "next";
import { LEGAL } from "@/i18n/legal";
import { loadPageContext } from "@/lib/page-context";
import { LegalDocument } from "@/components/LegalDocument";

// R340
export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const context = await loadPageContext(params.locale);
  return { title: `${LEGAL[context.locale].terms.title} — ${context.tenant.name}` };
}

export default async function TermsPage({ params }: { params: { locale: string } }) {
  const context = await loadPageContext(params.locale);
  const document = LEGAL[context.locale].terms;
  return (
    <LegalDocument
      document={document}
      salon={context.tenant.name}
      updatedLabel={context.t("legal.updated", { date: document.updated })}
    />
  );
}
