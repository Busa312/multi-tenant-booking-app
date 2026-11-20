// Draws the preview card a shared link shows (Facebook, Messenger, WhatsApp,
// Viber, Telegram, X…): 1200×630, one per language, into src/assets/og/.
//
//   pnpm --filter @booking/marketing dev    # or the whole `pnpm dev`
//   pnpm --filter @booking/marketing og
//
// The card is made from the running page itself — its logo, its headline
// (highlighter included), its fonts, its theme colors and its real CMS
// screenshot — so it can never say something the page doesn't. `screens`
// runs it after retaking the screenshots. Override MARKETING_URL or
// CHROMIUM_PATH if needed.

import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const MARKETING_URL = process.env.MARKETING_URL ?? "http://localhost:4321";
const OUT = fileURLToPath(new URL("../src/assets/og/", import.meta.url));
const PAGES = { ka: "/", en: "/en/", ru: "/ru/" };

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

try {
  for (const [locale, path] of Object.entries(PAGES)) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: "light" });
    await page.goto(new URL(path, MARKETING_URL).href, { waitUntil: "networkidle" });

    await page.evaluate(async () => {
      const logo = document.querySelector("header a span");
      // The slogan only: the home page's h1 also opens with a small keyword line.
      const headline = document.querySelector("h1 [data-headline]") ?? document.querySelector("h1");
      const shot = document.querySelector("main img");
      const host = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
      if (!logo || !headline || !shot || !host) throw new Error("The page is missing its logo, headline, screenshot or canonical link");

      document.querySelector("astro-dev-toolbar")?.remove();
      const card = document.createElement("div");
      card.style.cssText =
        "position:fixed;inset:0;z-index:9999;overflow:hidden;background:var(--color-base-200);color:var(--color-base-content);font-family:var(--font-sans);";

      const text = document.createElement("div");
      text.style.cssText =
        "position:absolute;left:72px;top:64px;bottom:64px;width:500px;display:flex;flex-direction:column;justify-content:space-between;";
      const brand = logo.cloneNode(true);
      brand.style.zoom = "1.5";
      const title = document.createElement("h1");
      title.innerHTML = headline.innerHTML;
      title.style.cssText = "margin:0;font-weight:600;letter-spacing:-0.025em;line-height:1.1;text-wrap:balance;";
      const domain = document.createElement("div");
      domain.textContent = new URL(host).hostname;
      domain.style.cssText = "font-size:26px;color:color-mix(in oklab, var(--color-base-content) 60%, transparent);";
      text.append(brand, title, domain);

      const frame = document.createElement("div");
      frame.style.cssText =
        "position:absolute;left:620px;top:96px;width:900px;border-radius:24px;overflow:hidden;background:var(--color-base-100);border:1px solid var(--color-base-300);box-shadow:0 30px 80px -20px rgb(0 0 0 / 0.25);";
      const image = document.createElement("img");
      image.src = shot.currentSrc || shot.src;
      image.style.cssText = "display:block;width:100%;height:auto;";
      frame.append(image);

      card.append(text, frame);
      document.body.append(card);

      // The biggest headline that fits between the logo and the domain.
      const room = text.clientHeight - brand.getBoundingClientRect().height - domain.offsetHeight - 48;
      for (let size = 76; size >= 36; size -= 2) {
        title.style.fontSize = `${size}px`;
        if (title.offsetHeight <= room) break;
      }
      await image.decode();
      await document.fonts.ready;
    });

    await page.screenshot({ path: `${OUT}og-${locale}.png` });
    await page.close();
    console.log(`og-${locale}.png`);
  }
} finally {
  await browser.close();
}
