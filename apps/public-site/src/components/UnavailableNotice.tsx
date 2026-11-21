import { TILE } from "@/lib/pageClasses";

interface UnavailableNoticeProps {
  heading: string;
  body: string;
}

export function UnavailableNotice({ heading, body }: UnavailableNoticeProps) {
  return (
    <section className={`${TILE} flex flex-col items-center px-6 py-14 text-center`}>
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{heading}</h1>
      <p className="mt-3 max-w-md text-pretty text-base-content/65">{body}</p>
    </section>
  );
}
