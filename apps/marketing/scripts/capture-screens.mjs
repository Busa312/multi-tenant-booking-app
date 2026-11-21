// Retakes the product screenshots in src/assets/screens from the real apps
// running locally, signed in as the seed's showcase business, Aura Beauty
// Studio ("aura") — a real-sounding name, so no screenshot says "Demo".
//
//   pnpm db:seed                       # once: the demo business
//   pnpm dev                           # api :3001, cms :5173, public-site :3000
//   pnpm --filter @booking/marketing exec playwright-core install chromium-headless-shell   # once
//   pnpm --filter @booking/marketing screens
//
// It books a believable day for the business first (on SHOT_DATE, the
// coming Saturday by default) unless that day already has those bookings, so
// the calendar isn't empty. Everything goes into your local database only.
// Override any of: CMS_URL, API_URL, SITE_URL (the demo business's booking
// site), SHOT_DATE (YYYY-MM-DD), CHROMIUM_PATH. ONLY=site retakes just the
// booking-site phone shots (after a booking-site change; needs only the API
// and public-site running), ONLY=cms just the CMS ones.
//
//   ONLY=site node scripts/capture-screens.mjs

import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const CMS_URL = process.env.CMS_URL ?? "http://localhost:5173";
const API_URL = process.env.API_URL ?? "http://localhost:3001";
const SITE_URL = process.env.SITE_URL ?? "http://aura.localhost:3000";
const OUT = fileURLToPath(new URL("../src/assets/screens/", import.meta.url));
// The seed's login for it (apps/api/prisma/seed.ts → AURA_BEAUTY).
const DEMO = { subdomain: "aura", email: "owner@aura.local", password: "password123" };

const comingSaturday = () => {
  const day = new Date();
  day.setDate(day.getDate() + (((6 - day.getDay() + 7) % 7) || 7));
  return day.toISOString().slice(0, 10);
};
const SHOT_DATE = process.env.SHOT_DATE ?? comingSaturday();
const ONLY = process.env.ONLY;
if (ONLY !== undefined && ONLY !== "site" && ONLY !== "cms") throw new Error(`ONLY must be "site" or "cms", not "${ONLY}"`);

// The seed's fixed ids for Aura (id series "a"): professionals "ad…", services "ae…".
const seedId = (kind, n) => `00000000-0000-0000-0000-0000000a${kind}${String(n).padStart(3, "0")}`;
// [professional, time, service, customer, phone] — Mariam 1, Tamar 2, Nino 3, Eka 4.
const DAY = [
  [1, "10:00", 1, "Salome Kapanadze", "599112233"],
  [1, "11:30", 6, "Tamar Beridze", "599223344"],
  [1, "14:30", 4, "Ana Gelashvili", "599334455"],
  [1, "16:00", 8, "Keti Lomidze", "599445566"],
  [2, "10:00", 13, "Nino Abashidze", "599556677"],
  [2, "12:00", 11, "Lika Dolidze", "599667788"],
  [2, "14:00", 14, "Giorgi Tsiklauri", "599778899"],
  [2, "16:30", 16, "Mari Jgenti", "599889900"],
  [3, "10:30", 43, "Eka Maisuradze", "599990011"],
  [3, "13:30", 38, "Sopo Arabuli", "598101112"],
  [3, "15:00", 49, "Natia Gogoladze", "598121314"],
  [4, "11:00", 35, "Tako Chkheidze", "598141516"],
  [4, "12:00", 41, "Nana Kvaratskhelia", "598161718"],
  [4, "17:00", 33, "Irma Bakradze", "598181920"],
];

const login = async (page) => {
  await page.goto(`${CMS_URL}/login`, { waitUntil: "networkidle" });
  await page.fill("#subdomain", DEMO.subdomain);
  await page.fill("#email", DEMO.email);
  await page.fill("#password", DEMO.password);
  await page.press("#password", "Enter");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
};

// Calls the API from inside the CMS page, so its session cookie and CSRF header apply.
const api = (page, path, init = {}) =>
  page.evaluate(
    async ([url, init]) => {
      const response = await fetch(url, {
        credentials: "include",
        ...init,
        headers: { "Content-Type": "application/json", "X-Requested-With": "booking-cms" },
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    [`${API_URL}${path}`, init],
  );

const bookTheDay = async (page) => {
  const existing = await api(page, `/cms/appointments?from=${SHOT_DATE}&to=${SHOT_DATE}`);
  const phones = new Set((existing.body ?? []).filter((a) => a.status === "booked").map((a) => a.phoneNumber));
  const locations = await api(page, "/cms/locations");
  const locationId = (locations.body ?? []).find((l) => l.isActive)?.id;
  for (const [pro, time, service, userName, phoneNumber] of DAY) {
    if (phones.has(phoneNumber)) continue;
    const result = await api(page, "/cms/appointments", {
      method: "POST",
      body: JSON.stringify({
        professionalId: seedId("d", pro),
        serviceIds: [seedId("e", service)],
        ...(locationId ? { locationId } : {}),
        date: SHOT_DATE,
        time,
        userName,
        phoneNumber,
      }),
    });
    if (result.status >= 300) console.warn(`  couldn't book ${userName} at ${time}: ${result.status}`);
  }
};

const settle = (page) => page.waitForLoadState("networkidle").then(() => page.waitForTimeout(600));

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
await mkdir(OUT, { recursive: true });
try {
  for (const lang of ["en", "ka", "ru"]) {
    for (const scheme of ONLY === "site" ? [] : ["light", "dark"]) {
      // The CMS follows the OS theme, and keeps its language in localStorage.
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: "reduce" });
      const page = await context.newPage();
      await login(page);
      if (lang === "en" && scheme === "light") await bookTheDay(page);
      await page.evaluate((value) => localStorage.setItem("booking_cms_lang", value), lang);

      // The laptop in the hero: 1440×900, i.e. 16:10.
      await page.goto(`${CMS_URL}/bookings`, { waitUntil: "networkidle" });
      await page.locator('input[type="date"]').first().fill(SHOT_DATE);
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
      await page.mouse.move(0, 0);
      await settle(page);
      await page.screenshot({ path: `${OUT}cms-bookings-${lang}-${scheme}.png` });

      // The window in the workspace section: narrower, as the page is.
      await page.setViewportSize({ width: 1200, height: 860 });
      await page.goto(`${CMS_URL}/hours`, { waitUntil: "networkidle" });
      await settle(page);
      await page.screenshot({ path: `${OUT}cms-hours-${lang}-${scheme}.png` });
      await context.close();
    }

    if (ONLY === "cms") {
      console.log(`✓ ${lang}`);
      continue;
    }
    // The booking site has one look per business, so no dark shot. 390×844 = PhoneFrame.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    const phone = await context.newPage();
    await phone.goto(`${SITE_URL}/${lang}`, { waitUntil: "networkidle" });
    await settle(phone);
    await phone.screenshot({ path: `${OUT}site-home-${lang}.png` });

    await phone.goto(`${SITE_URL}/${lang}/book`, { waitUntil: "networkidle" });
    await settle(phone);
    const services = phone.locator('input[type="checkbox"]');
    await services.nth(0).check({ force: true });
    await services.nth(4).check({ force: true });
    await phone.evaluate(() => window.scrollTo(0, 0));
    await settle(phone);
    await phone.screenshot({ path: `${OUT}site-book-${lang}.png` });
    await context.close();
    console.log(`✓ ${lang}`);
  }
} finally {
  await browser.close();
}
console.log(`Screens written to ${OUT}${ONLY === "site" ? "" : ` (bookings on ${SHOT_DATE})`}.`);
