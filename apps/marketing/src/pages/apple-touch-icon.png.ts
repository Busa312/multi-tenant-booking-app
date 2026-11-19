import type { APIRoute } from "astro";
import { homeScreenIcon } from "../lib/brandMark";

// The icon a phone shows when the site is saved to its home screen. Rendered
// at build time; iOS also asks for this path without being told.
export const GET: APIRoute = async () =>
  new Response(await homeScreenIcon(), { headers: { "Content-Type": "image/png" } });
