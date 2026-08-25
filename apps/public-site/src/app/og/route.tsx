import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { DEFAULT_TENANT_COLORS } from "@booking/shared-types";
import { getCachedTenant, resolveTenantColors } from "@/lib/tenant-config";

/**
 * The social share card, drawn from the tenant's name and their saved palette.
 *
 * Generated rather than uploaded because there is no file-upload path anywhere
 * in this platform — so every tenant gets a correct card with no effort, and the
 * CMS's ogImageUrl field stays a pure override.
 *
 * Reads the tenant from the Host header, so it must be dynamic. The `?v=` token
 * the metadata appends is what makes ImageResponse's immutable cache header
 * safe: a renamed salon is simply a different URL.
 */
export const dynamic = "force-dynamic";

// Node, not edge: next/og resolves its Node build when NEXT_RUNTIME isn't
// "edge", and this route reads API_URL and reuses the same host-tagged tenant
// cache the pages do. Edge would complicate both for nothing.
export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

// next/og bundles a Latin-only face, so a Georgian salon name would render as
// empty boxes without this. See src/assets/README.md.
async function loadFont(): Promise<ArrayBuffer> {
  const file = path.join(process.cwd(), "src/assets/NotoSansGeorgian-SemiBold.ttf");
  const buffer = await readFile(file);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export async function GET() {
  const host = headers().get("host") ?? "";

  let name = "";
  let colors = DEFAULT_TENANT_COLORS;
  try {
    const tenant = await getCachedTenant(host);
    name = tenant.name;
    colors = resolveTenantColors(tenant);
  } catch {
    // An unknown host still gets a valid image rather than a broken one — a
    // scraper that 500s here would show the link with no card at all.
  }

  const font = await loadFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: colors.background,
          color: colors.text,
          fontFamily: "Noto Sans Georgian",
        }}
      >
        {/* A brand-coloured rule rather than a logo: logoUrl is an arbitrary
            remote image, and fetching one here would make the card's render
            time depend on a third party. */}
        <div style={{ width: 120, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />
        <div style={{ marginTop: 40, fontSize: 76, lineHeight: 1.15, letterSpacing: "-0.02em" }}>{name}</div>
        <div style={{ marginTop: 24, fontSize: 32, color: colors.primary }}>Book online</div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [{ name: "Noto Sans Georgian", data: font, weight: 600, style: "normal" }],
    },
  );
}
