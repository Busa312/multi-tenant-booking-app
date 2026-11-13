import Link from "next/link";

interface BookCtaProps {
  label: string;
  /** R160: turns a site path into a link in the language being read. */
  href: (path: string) => string;

  locationId?: string;
  variant?: "hero" | "inline";
}

export function BookCta({ label, href: hrefFor, locationId, variant = "hero" }: BookCtaProps) {
  const href = hrefFor("/book") + (locationId ? `?locationId=${encodeURIComponent(locationId)}` : "");

  return (
    <Link
      className={
        variant === "hero"
          ? // Inverted: it sits on the primary-colored hero. Set through daisyUI's
            // button variables so hover and focus still derive from them.
            "btn btn-lg w-full gap-2 [--btn-color:var(--color-primary-content)] [--btn-fg:var(--color-primary)] sm:w-auto"
          : "btn btn-outline btn-primary btn-sm self-start"
      }
      href={href}
    >
      {label}
      <span aria-hidden="true">→</span>
    </Link>
  );
}
