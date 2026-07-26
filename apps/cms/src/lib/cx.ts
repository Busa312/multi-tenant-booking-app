// Tiny classname joiner — drops falsy parts so components can compose module
// classes with conditional ones without scattering `.filter(Boolean).join`.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
