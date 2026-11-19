import type { APIRoute } from "astro";
import { logoIcon } from "../lib/brandMark";

// The brand's logo for search engines (the Organization in BaseLayout's
// structured data): a square PNG, rendered at build time.
export const GET: APIRoute = async () => new Response(await logoIcon(), { headers: { "Content-Type": "image/png" } });
