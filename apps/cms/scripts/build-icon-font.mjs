// Downloads a Material Symbols Outlined font that contains only the icons in
// src/lib/iconNames.ts, and saves it as src/assets/fonts/material-symbols-outlined.woff2.
// The full font is ~317 KB; the subset is a few KB. Re-run after adding an
// icon: `pnpm --filter @booking/cms icons`.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = await readFile(`${root}src/lib/iconNames.ts`, "utf8");
const list = source.slice(source.indexOf("ICON_NAMES = ["), source.indexOf("] as const"));
const names = [...list.matchAll(/"([a-z0-9_]+)"/g)].map((match) => match[1]);
if (names.length === 0) throw new Error("no icon names found in src/lib/iconNames.ts");
const sorted = [...names].sort();
if (sorted.join() !== names.join()) throw new Error("ICON_NAMES must be sorted (Google Fonts requires it)");

// Optical size 24, weight 400, grade 0, and FILL as a 0–1 axis: icons are
// outlined by default, and the map pin sets FILL 1 to draw the solid glyph.
const cssUrl =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0" +
  `&icon_names=${names.join(",")}&display=block`;
// A current browser user agent, so Google answers with woff2.
const headers = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
};
const css = await (await fetch(cssUrl, { headers })).text();
const fontUrl = css.match(/url\((https:[^)]+)\)/)?.[1];
if (!fontUrl) throw new Error(`no font URL in Google's answer:\n${css}`);

const font = Buffer.from(await (await fetch(fontUrl, { headers })).arrayBuffer());
const target = `${root}src/assets/fonts/material-symbols-outlined.woff2`;
await writeFile(target, font);
console.log(`${names.length} icons, ${(font.length / 1024).toFixed(1)} KB → ${target}`);
