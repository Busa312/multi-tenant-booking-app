import type { ImageMetadata } from "astro";
import type { Locale } from "../i18n";

// Real screenshots of the product (src/assets/screens), taken from the seed's
// showcase business (Aura Beauty Studio) by scripts/capture-screens.mjs. The CMS is shot in light and
// dark (it follows the OS, so the page does too); the booking site has one
// look per business, so it has no dark shot.
const files = import.meta.glob<{ default: ImageMetadata }>("../assets/screens/*.png", { eager: true });

const shot = (name: string): ImageMetadata => {
  const file = files[`../assets/screens/${name}.png`];
  if (!file) throw new Error(`Missing screenshot ${name}.png — run scripts/capture-screens.mjs`);
  return file.default;
};

export interface Screen {
  light: ImageMetadata;
  dark?: ImageMetadata;
}

const cms = (page: string, locale: Locale): Screen => ({
  light: shot(`cms-${page}-${locale}-light`),
  dark: shot(`cms-${page}-${locale}-dark`),
});

export const screensFor = (locale: Locale) => ({
  calendar: cms("bookings", locale),
  hours: cms("hours", locale),
  site: { light: shot(`site-home-${locale}`) } as Screen,
  booking: { light: shot(`site-book-${locale}`) } as Screen,
});
