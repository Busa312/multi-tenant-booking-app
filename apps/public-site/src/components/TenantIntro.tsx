interface TenantIntroProps {
  title: string;
  description: string;
}

// R170: the tenant's own heading and blurb. Colorless on purpose: it takes the
// text color of whatever block it sits on (the primary-colored hero).
export function TenantIntro({ title, description }: TenantIntroProps) {
  return (
    <section className="max-w-2xl">
      <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight text-balance break-words sm:text-6xl">
        {title}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-pretty">{description}</p>
    </section>
  );
}
