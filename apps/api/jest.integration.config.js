/**
 * Integration tests: a real Postgres, as the real roles. What a unit test
 * can't prove — that the RLS policies actually isolate tenants, and that the
 * booking lock (R260) actually serializes concurrent writers.
 *
 * Needs DATABASE_URL (the migration owner, for fixtures and the catalog
 * checks) and APP_DATABASE_URL (the RLS-bound runtime role, for everything
 * under test), with migrations applied. Read from the environment, else from
 * apps/api/.env. Kept out of `pnpm test`, which must run with nothing up.
 */
const base = require("./jest.config.js");

/** @type {import("jest").Config} */
module.exports = {
  ...base,
  testRegex: "\\.int-spec\\.ts$",
  setupFiles: ["<rootDir>/test/load-env.js"],
  testTimeout: 30_000,
  // One database, shared fixtures: no parallel files racing each other.
  maxWorkers: 1,
};
