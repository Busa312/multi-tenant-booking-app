import Link from "next/link";
import styles from "./BookCta.module.css";

interface BookCtaProps {
  label: string;

  locationId?: string;
  variant?: "hero" | "inline";
}

export function BookCta({ label, locationId, variant = "hero" }: BookCtaProps) {
  const href = locationId ? `/book?locationId=${encodeURIComponent(locationId)}` : "/book";

  return (
    <Link className={styles.cta} data-variant={variant} href={href}>
      {label}
    </Link>
  );
}
