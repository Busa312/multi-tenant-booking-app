import { headers } from "next/headers";
import { getCachedTenant, resolveTenantColors } from "@/lib/tenant-config";
import { tenantThemeVars } from "@/lib/tenant-theme";

const escapeXml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);

/**
 * The salon's browser-tab icon: its initial on its own primary color. An SVG
 * rather than a rendered PNG so the letter is set in the visitor's system
 * font — Georgian initials included — with nothing to download or rasterize.
 *
 * Colors come through resolveTenantColors (every value has passed
 * isValidColor) and the initial is XML-escaped: nothing a salon saved reaches
 * the markup raw.
 */
export async function GET() {
  const salon = await getCachedTenant(headers().get("host") ?? "").catch(() => null);
  if (!salon) {
    return new Response(null, { status: 404 });
  }

  const colors = tenantThemeVars(resolveTenantColors(salon));
  const initial = Array.from(salon.name.trim())[0]?.toLocaleUpperCase() ?? "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="${colors["--tenant-primary"]}"/>` +
    `<text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" ` +
    `font-size="38" font-weight="800" fill="${colors["--tenant-primary-content"]}">${escapeXml(initial)}</text>` +
    `</svg>`;

  return new Response(svg, {
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
