/**
 * Unit tests only — no database, no Nest application bootstrap. Every spec
 * constructs its subject directly with stubbed collaborators, so `pnpm test`
 * stays runnable without Postgres/Redis. Integration coverage of the RLS
 * policies themselves needs a real database and is a separate concern.
 */

/** @type {import("jest").Config} */
module.exports = {
  rootDir: ".",
  roots: ["<rootDir>/src"],
  testEnvironment: "node",
  testRegex: "\\.spec\\.ts$",
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
  // src/ uses ESM-style `./foo.js` specifiers that resolve to `./foo.ts` at
  // build time (module: CommonJS). Jest's resolver needs the same mapping.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  clearMocks: true,
  collectCoverageFrom: ["**/*.ts", "!**/*.spec.ts", "!main.ts", "!**/*.module.ts"],
};
