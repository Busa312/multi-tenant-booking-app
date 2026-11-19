import type { ImageMetadata } from "astro";
import type { Locale } from "../i18n";

// The preview card a shared link shows, one per language (1200×630), drawn
// from the page itself by scripts/capture-og.mjs.
const files = import.meta.glob<{ default: ImageMetadata }>("../assets/og/*.png", { eager: true });

/** Undefined until the script has drawn it (it draws from the page, so the page renders without one). */
export const shareImageFor = (locale: Locale): ImageMetadata | undefined => {
  const file = files[`../assets/og/og-${locale}.png`];
  if (!file) console.warn(`[share image] Missing og-${locale}.png — run scripts/capture-og.mjs`);
  return file?.default;
};
