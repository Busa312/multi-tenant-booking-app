// Mirrors isValidColor in packages/shared-types/src/colors.ts. Duplicated
// rather than imported: @booking/shared-types ships raw TypeScript ESM
// source with no build step, and apps/api's compiled dist/main.js is run by
// plain `node` at runtime, which can't execute that source directly. Every
// other reference to @booking/shared-types from apps/api is `import type`
// only (erased at compile time, no runtime require() generated) — this is
// the one place an actual runtime value is needed.
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR_RE = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;

// Accepts `unknown`, not just `string` — see packages/shared-types/src/colors.ts's
// isValidColor for why: a color field ultimately comes from an unvalidated
// HTTP JSON body, so it can be null/a number/an array at runtime regardless
// of what the compile-time type says, and a naive string-typed check would
// throw (`.match` doesn't exist on those) instead of returning false.
export function isValidColor(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  if (HEX_COLOR_RE.test(value)) {
    return true;
  }
  const match = value.match(RGB_COLOR_RE);
  if (!match) {
    return false;
  }
  return match.slice(1, 4).every((component) => Number(component) <= 255);
}
