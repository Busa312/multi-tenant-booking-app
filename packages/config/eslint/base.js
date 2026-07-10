// Legacy (.eslintrc) shareable config, not flat config — eslint-config-next@14
// and eslint-plugin-react-hooks@4 (Next 14's pinned major) don't support
// ESLint 9 flat config; Next 15 is where that lands. Revisit once this repo
// upgrades Next.

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: ["dist/**", ".next/**", "node_modules/**", "generated/**"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  },
};
