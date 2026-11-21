interface TenantIntroProps {
  /** A small line above the title (the salon's name), or null for none. */
  eyebrow: string | null;
  title: string;
  description: string;
}

// R170: the tenant's own heading and blurb, set like a product page's opening.
export function TenantIntro({ eyebrow, title, description }: TenantIntroProps) {
  return (
    <section className="flex max-w-2xl flex-col items-center">
      {eyebrow && <p className="mb-3 text-base font-semibold text-primary sm:text-lg">{eyebrow}</p>}
      <h1 className="text-5xl leading-[1.05] font-semibold tracking-tight text-balance break-words sm:text-7xl">
        {title}
      </h1>
      <p className="mt-5 max-w-xl text-lg text-pretty text-base-content/65 sm:text-xl">{description}</p>
    </section>
  );
}
