import type { LegalText } from "@/i18n/legal";

interface LegalDocumentProps {
  document: LegalText;
  /** Fills {salon} in the template text. */
  salon: string;
  updatedLabel: string;
}

const fill = (text: string, salon: string) => text.replaceAll("{salon}", salon);

/** R340: a privacy policy or terms page — plain, readable prose. */
export function LegalDocument({ document, salon, updatedLabel }: LegalDocumentProps) {
  return (
    <article className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{document.title}</h1>
        <p className="text-sm text-base-content/65">{updatedLabel}</p>
        <p className="leading-relaxed text-base-content/80">{fill(document.intro, salon)}</p>
      </header>
      {document.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="leading-relaxed text-base-content/80">
              {fill(paragraph, salon)}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
