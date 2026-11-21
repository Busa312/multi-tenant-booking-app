import Link from "next/link";
import { MORE_LINK } from "@/lib/pageClasses";
import { ChevronRight } from "./ChevronRight";

interface BookCtaProps {
  label: string;
  /** R160: turns a site path into a link in the language being read. */
  href: (path: string) => string;

  locationId?: string;
  /** "hero": the page's one large pill button. "inline": a text link with a chevron. */
  variant?: "hero" | "inline";
}

export function BookCta({ label, href: hrefFor, locationId, variant = "hero" }: BookCtaProps) {
  const href = hrefFor("/book") + (locationId ? `?locationId=${encodeURIComponent(locationId)}` : "");

  if (variant === "inline") {
    return (
      <Link className={MORE_LINK} href={href}>
        {label}
        <ChevronRight />
      </Link>
    );
  }
  return (
    <Link className="btn btn-primary btn-lg px-8" href={href}>
      {label}
    </Link>
  );
}
