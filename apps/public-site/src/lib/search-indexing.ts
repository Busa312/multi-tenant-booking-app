/**
 * R390: whether this deployment keeps search engines out — staging sets
 * `BLOCK_SEARCH_ENGINES=true` so its test salons never appear in results.
 * Production leaves it unset. next.config.mjs reads the same variable for the
 * `X-Robots-Tag` header on every page.
 */
export function searchEnginesBlocked(value: string | undefined = process.env.BLOCK_SEARCH_ENGINES): boolean {
  return value?.trim().toLowerCase() === "true";
}
