import styles from "./SearchResultPreview.module.css";

interface SearchResultPreviewProps {
  /** Already resolved through the shared resolvers — never re-derived here. */
  title: string;
  description: string;
  /** The canonical origin the tenant's site will actually be listed under. */
  url: string;
}

/**
 * A mock of how the salon's listing reads on a results page.
 *
 * Deliberately dumb: it takes finished strings. The fallback chain that turns an
 * empty form into "Acme Salon — Book online" lives in @booking/shared-types and
 * is the same code the public site's <head> runs, so this preview cannot drift
 * into showing something the real page doesn't say.
 */
export function SearchResultPreview({ title, description, url }: SearchResultPreviewProps) {
  return (
    <div className={styles.result}>
      <div className={styles.url}>{url}</div>
      <div className={styles.title}>{title}</div>
      <p className={styles.description}>{description}</p>
    </div>
  );
}
