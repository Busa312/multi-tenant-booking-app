/**
 * Unit tests for the logic that genuinely lives in this package rather than in
 * a consumer — the localization fallback rule (i18n.ts) and the color
 * validation/contrast helpers (colors.ts). Both are imported at *runtime* by
 * apps/cms and apps/public-site, so a regression here is a regression in two
 * apps at once, and neither app has a test runner yet.
 *
 * `.cjs` pins this file to CommonJS explicitly, whatever the package's `"type"`.
 * The package is deliberately *not* `"type": "module"`: apps/api resolves it with
 * `moduleResolution: Node16` from CommonJS, and an ESM-typed package there breaks
 * every `import type` (TS1541). Vite and Next ignore the field, so the frontends
 * are unaffected. ts-jest compiles the sources to CommonJS, as apps/api's config
 * does; the package's own imports are extensionless, so nothing needs remapping.
 */

/** @type {import("jest").Config} */
module.exports = {
  rootDir: ".",
  roots: ["<rootDir>/src"],
  testEnvironment: "node",
  testRegex: "\\.spec\\.ts$",
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  clearMocks: true,
};
