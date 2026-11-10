import Link from "next/link";

interface BookCtaProps {
  label: string;

  locationId?: string;
  variant?: "hero" | "inline";
}

export function BookCta({ label, locationId, variant = "hero" }: BookCtaProps) {
  const href = locationId ? `/book?locationId=${encodeURIComponent(locationId)}` : "/book";

  return (
    <Link
      className={
        variant === "hero"
          ? "btn btn-primary btn-lg w-full gap-2 shadow-md sm:w-auto"
          : "btn btn-outline btn-primary btn-sm self-start"
      }
      href={href}
    >
      {label}
      <span aria-hidden="true">→</span>
    </Link>
  );
}
