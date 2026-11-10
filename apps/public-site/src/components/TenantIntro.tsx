interface TenantIntroProps {
  title: string;
  description: string;
}

// R170: the tenant's own heading and blurb
export function TenantIntro({ title, description }: TenantIntroProps) {
  return (
    <section className="max-w-xl">
      <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">{title}</h1>
      <p className="mt-3 text-lg text-pretty text-base-content/70">{description}</p>
    </section>
  );
}
