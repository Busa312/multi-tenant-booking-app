import type { Messages } from "./types";

// Every claim here is something the product does today — each line names the
// requirement it rests on, so a change to the product can find its copy.
export const en: Messages = {
  htmlLang: "en",
  ogLocale: "en_US",
  meta: {
    title: "Online booking system for service businesses",
    description:
      "A booking site in your colors, one calendar for your whole team, and confirmations by text. Clients book your services in a minute — 14 days free.",
  },
  nav: {
    features: "Features",
    howItWorks: "How it works",
    pricing: "Pricing",
    faq: "FAQ",
    signIn: "Sign in",
    getApp: "Get the app",
    cta: "Get started",
    menu: "Menu",
    language: "Language",
    home: "Home",
  },
  hero: {
    eyebrow: "Online booking system for service businesses",
    title: { before: "Your service gets", mark: "booked", after: " while you work." },
    lead: "A booking site in your colors, one calendar for your whole team, and confirmations by text. Clients book in a minute — no app, no password.",
    primaryCta: "Start your free trial",
    secondaryCta: "See how it works",
    note: "14 days free. No card needed to start.", // R480
  },
  proof: [
    { value: "24/7", label: "bookings, even after closing" },
    { value: "3 steps", label: "service, time, phone number" }, // R270
    { value: "3", label: "languages: Georgian, English and Russian" }, // R160, R570
    { value: "0", label: "apps or passwords for your clients" }, // R230
  ],
  bookingSite: {
    eyebrow: "The booking site",
    title: "Looks like yours. Because it is.",
    lead: "Your logo, your colors and your words, in Georgian, English and Russian. Services grouped the way you think about them, prices up front, and only the times that are really free.",
    points: [
      "Your own address — or your own domain", // §7
      "Several services in one visit, even with different people", // R200
      "Clients choose who — or “anyone”, shared out fairly", // R450
      "Put it on your own website with the booking widget", // R410
    ],
  },
  calendar: {
    eyebrow: "Your workspace",
    title: "Run the day from one place.",
    lead: "Every booking in one list, every branch in its own tab. Book a walk-in, move an appointment, set opening hours and time off — and the booking site follows at once.",
    points: [
      "Owners see everything; professionals see their own day", // CMS roles
      "See who missed their last visits before they arrive", // R360
      "Block a number that keeps not showing up", // R380
      "Opening hours, days off and time off for each person", // R460
    ],
  },
  features: {
    eyebrow: "Features",
    title: "Everything you need. Nothing you don’t.",
    items: [
      {
        icon: "visit",
        title: "Visits, not just appointments",
        body: "Two services with two different people — booked as one visit, back to back.", // R200
      },
      {
        icon: "fair",
        title: "A fair “anyone available”",
        body: "When a client doesn’t mind who, the booking goes to whoever has the lightest day.", // R450
      },
      {
        icon: "globe",
        title: "Three languages",
        body: "Georgian, English and Russian — on your booking site and in the CMS your team uses.", // R160, R570
      },
      {
        icon: "link",
        title: "Changes without phone calls",
        body: "Clients reschedule or cancel from their link, up to the cutoff you choose.", // R230, R300
      },
      {
        icon: "shield",
        title: "No double bookings",
        body: "A time is held while a client finishes, and two bookings can never land on the same slot.", // R250, R260
      },
      {
        icon: "pin",
        title: "Every branch, one account",
        body: "Each location with its own team and hours. Clients pick where they’re going.", // R150
      },
      {
        icon: "history",
        title: "No-show history",
        body: "A quiet flag on bookings from clients who missed their recent visits.", // R360
      },
      {
        icon: "steps",
        title: "Guided setup",
        body: "Locations, hours, services and team, in order. Skip anything and come back later.", // R420
      },
    ],
  },
  steps: {
    eyebrow: "How it works",
    title: "Up and running in an afternoon.",
    items: [
      {
        title: "We open your account",
        body: "Tell us about your business. We create your workspace and email you a link to set your password.", // R430
      },
      {
        title: "Add your services and team",
        body: "A guided setup walks you through hours, services and professionals. Skip anything, come back anytime.", // R420
      },
      {
        title: "Share your link",
        body: "On Instagram, on Google Maps, on your website. Bookings start coming in.",
      },
    ],
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Simple monthly pricing.",
    lead: "Every plan has the booking site, the calendar and your whole team. Start with 14 days free.",
    perMonth: "per month",
    earlyBadge: "Early-adopter price",
    locations: (limit) => (limit === null ? "Any number of locations" : limit === 1 ? "1 location" : `Up to ${limit} locations`),
    included: ["Unlimited professionals and services", "Booking site in Georgian, English and Russian"], // R500
    prioritySupport: "Priority support",
    cta: "Get started",
    footnote:
      "Prices in GEL, paid monthly by card. Nothing is charged per booking.", // R470
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions, answered.",
    items: [
      {
        q: "Do my clients need an app or an account?",
        a: "No. They book on your site in their browser and confirm with a code sent to their phone. The link in their text lets them reschedule or cancel.", // R230, R270
      },
      {
        q: "Do clients pay online?",
        a: "No. A booking is a reservation; clients pay you in person.",
      },
      {
        q: "What happens when the free trial ends?",
        a: "Choose a plan and pay by card in the CMS. If you don’t, your booking site pauses new online bookings — your calendar and everything in it stay as they are.", // R490
      },
      {
        q: "Can I use my own domain?",
        a: "Yes. Every business gets its own address with us, and we can connect your domain for you.",
      },
      {
        q: "Can I add booking to the website I already have?",
        a: "Yes — with the booking widget, as the full booking form or a small “Book” button that opens it.", // R410
      },
    ],
  },
  finalCta: {
    title: { before: "Ready when", mark: "you are.", after: "" },
    lead: "Tell us about your business and we’ll get you set up.",
    primary: "Get started",
    secondary: "Sign in",
  },
  footer: {
    tagline: "Online booking for service businesses.",
    contact: "Contact",
    rights: "All rights reserved.",
  },
  contact: {
    meta: {
      title: "Get started",
      description: "Tell us about your business and we’ll set up your booking site. 14 days free.",
    },
    eyebrow: "Get started",
    title: "Tell us about your business.",
    lead: "Leave your details and we’ll get in touch to set up your account. The first 14 days are free.",
    name: "Your name",
    business: "Business name",
    phone: "Phone number",
    phonePlaceholder: "+995 5XX XX XX XX",
    email: "Email",
    message: "Anything we should know?",
    messagePlaceholder: "What you do, how many people work with you, how many branches…",
    optional: "optional",
    submit: "Send",
    privacy: "We use these details only to get back to you.",
    orEmail: "Prefer email? Write to",
    thanks: {
      title: "Thanks — we’ll be in touch.",
      body: "We’ve got your request and will contact you soon to set up your account.",
      back: "Back to the home page",
    },
    sorry: {
      title: "That didn’t go through.",
      body: "Your request couldn’t be sent. Check your details and try again in a moment.",
      retry: "Try again",
    },
  },
  screens: {
    calendar: "A day’s bookings in the CMS",
    site: "A business’s booking site on a phone",
    booking: "Choosing services on the booking site",
    hours: "Opening hours in the CMS",
  },
};
