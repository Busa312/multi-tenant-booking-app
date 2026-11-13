interface UnavailableNoticeProps {
  heading: string;
  body: string;
}

export function UnavailableNotice({ heading, body }: UnavailableNoticeProps) {
  return (
    <section className="border-t-2 border-accent pt-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-balance">{heading}</h1>
      <p className="mt-3 max-w-md text-base-content/70">{body}</p>
    </section>
  );
}
