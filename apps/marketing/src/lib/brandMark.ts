import sharp from "sharp";

// The mark (Logo.astro, public/favicon.svg) as standalone PNGs for places that
// can't take the themed SVG: the iPhone home-screen icon and the logo in the
// structured data. Colors are the light theme's (styles/theme.css): ink tile,
// paper tick, highlighter dot. Change them there, change them here.
const ink = "#15181b";
const paper = "#ffffff";
const highlighter = "#ffe45c";

const tick = `<path d="m8.5 14.5 3.5 3.5 7.5-8" fill="none" stroke="${paper}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

/** The mark as drawn on the page: a rounded tile on a transparent background. */
const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
  <rect width="28" height="28" rx="8" fill="${ink}"/>${tick}
  <circle cx="22.5" cy="5.5" r="3.5" fill="${highlighter}" stroke="${paper}" stroke-width="1.5"/>
</svg>`;

/** Full-bleed and shrunk to the middle: iOS rounds the corners itself and would clip the dot. */
const homeScreenSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
  <rect width="28" height="28" fill="${ink}"/>
  <g transform="translate(14 14) scale(0.72) translate(-14 -14)">${tick}
    <circle cx="22.5" cy="5.5" r="3.5" fill="${highlighter}" stroke="${ink}" stroke-width="1.5"/>
  </g>
</svg>`;

const png = async (svg: string, size: number) =>
  new Uint8Array(await sharp(Buffer.from(svg), { density: 72 * (size / 28) }).resize(size, size).png().toBuffer());

export const homeScreenIcon = () => png(homeScreenSvg, 180);
export const logoIcon = () => png(tileSvg, 512);
