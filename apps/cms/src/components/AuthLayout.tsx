import type { FormEvent, ReactNode } from "react";
import { Brand } from "./ui/Brand.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import styles from "./AuthLayout.module.css";

interface AuthLayoutProps {
  /** Marketing copy in the decorative left panel. */
  headline: string;
  artSub: string;
  /** Heading + subheading above the form fields. */
  title: string;
  subtitle: string;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}

// Shared split-screen chrome for the unauthenticated screens (Login,
// SetPassword) — art panel on the left, a centered form on the right.
export function AuthLayout({ headline, artSub, title, subtitle, onSubmit, children }: AuthLayoutProps) {
  return (
    <div className={styles.screen}>
      <div className={styles.art}>
        <Brand size="lg" onDark className={styles.artBrand} />
        <div className={styles.artCopy}>
          <div className={styles.artHeadline}>{headline}</div>
          <div className={styles.artSub}>{artSub}</div>
        </div>
      </div>

      <div className={styles.formWrap}>
        <LanguageSwitcher className={styles.lang} />
        <form className={`${styles.form} fade-up`} onSubmit={onSubmit}>
          <Brand className={styles.formBrand} />
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
          {children}
        </form>
      </div>
    </div>
  );
}
