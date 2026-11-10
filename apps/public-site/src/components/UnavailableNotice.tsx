interface UnavailableNoticeProps {
  heading: string;
  body: string;
}

export function UnavailableNotice({ heading, body }: UnavailableNoticeProps) {
  return (
    <section className="rounded-box border border-warning/30 bg-warning/10 px-6 py-10 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
      <p className="mx-auto mt-3 max-w-md text-base-content/70">{body}</p>
    </section>
  );
}
