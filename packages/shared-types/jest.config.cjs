/**
 * Unit tests for the logic that genuinely lives in this package rather than in
 * a consumer — the localization fallback rule (i18n.ts) and the color
 * validation/contrast helpers (colors.ts). Both are imported at *runtime* by
 * apps/cms and apps/public-site, so a regression here is a regression in two
 * apps at once, and neither app has a test runner yet.
 *
 * `.cjs` rather than `.js` because this package is `"type": "module"` — a plain
 * jest.config.js would be parsed as ESM and `module.exports` would be undefined.
 * ts-jest compiles the sources to CommonJS for the same reason apps/api's config
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
