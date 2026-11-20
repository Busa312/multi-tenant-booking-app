
export const locales = ["ka", "en", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ka";

export interface TitledText {
  title: string;
  body: string;
}

/** A headline with one phrase under the highlighter: `before`, a space, `mark`, then `after` as written (it carries its own leading space or comma). */
export interface MarkedTitle {
  before: string;
  mark: string;
  after: string;
}

export interface FeatureCopy extends TitledText {
  icon: IconName;
}

export type IconName =
  | "visit"
  | "fair"
  | "sms"
  | "link"
  | "shield"
  | "pin"
  | "history"
  | "steps"
  | "check"
  | "globe"
  | "menu"
  | "arrow";

export interface Messages {
  /** BCP 47 tag for `<html lang>` and og:locale. */
  htmlLang: string;
  ogLocale: string;
  /** The page title gets " · <brand>" appended. */
  meta: { title: string; description: string };
  nav: {
    features: string;
    howItWorks: string;
    pricing: string;
    faq: string;
    signIn: string;
    cta: string;
    menu: string;
    /** Names the language switcher (its aria-label). */
    language: string;
    /** Read after the brand name on the logo link: "Book-it — Home". */
    home: string;
  };
  hero: {
    eyebrow: string;
    title: MarkedTitle;
    lead: string;
    primaryCta: string;
    secondaryCta: string;
    note: string;
  };
  proof: { value: string; label: string }[];
  bookingSite: {
    eyebrow: string;
    title: string;
    lead: string;
    points: string[];
  };
  calendar: {
    eyebrow: string;
    title: string;
    lead: string;
    points: string[];
  };
  features: {
    eyebrow: string;
    title: string;
    items: FeatureCopy[];
  };
  steps: {
    eyebrow: string;
    title: string;
    items: TitledText[];
  };
  pricing: {
    eyebrow: string;
    title: string;
    lead: string;
    perMonth: string;
    earlyBadge: string;
    locations: (limit: number | null) => string;
    included: string[];
    prioritySupport: string;
    cta: string;
    footnote: string;
  };
  faq: {
    eyebrow: string;
    title: string;
    items: { q: string; a: string }[];
  };
  finalCta: { title: MarkedTitle; lead: string; primary: string; secondary: string };
  footer: { tagline: string; contact: string; rights: string };
  /** R580: the contact page and the two pages its form leads to. */
  contact: {
    meta: { title: string; description: string };
    eyebrow: string;
    title: string;
    lead: string;
    name: string;
    business: string;
    phone: string;
    phonePlaceholder: string;
    email: string;
    message: string;
    messagePlaceholder: string;
    optional: string;
    submit: string;
    privacy: string;
    /** Before the email link under the form. */
    orEmail: string;
    thanks: { title: string; body: string; back: string };
    sorry: { title: string; body: string; retry: string };
  };
  /** Alt text of the real product screenshots (lib/screens.ts). */
  screens: { calendar: string; site: string; booking: string; hours: string };
}
