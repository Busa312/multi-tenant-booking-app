// Class strings shared by the sections of the booking site's pages, so the
// home page, the embeds and the pages around the wizard read as one product
// page: the same heading scale, the same tiles, the same "more" links.
// Colors are daisyUI roles only — each tenant's palette applies.

/** A section's heading: large, tight, semibold. */
export const SECTION_HEADING = "text-3xl font-semibold tracking-tight text-balance sm:text-4xl";

/** A soft rounded surface on the page — the grey tile that holds a list or a block of facts. */
export const TILE = "rounded-box bg-base-200";

/** An inset list: rows split by hairlines inside a tile. */
export const TILE_LIST = "divide-y divide-base-300 rounded-box bg-base-200 px-5";

/** A text link in the primary color with a chevron after it ("Book here ›"). */
export const MORE_LINK =
  "inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline";
