/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["../../packages/config/eslint/base.js", "plugin:astro/recommended"],
  ignorePatterns: [".astro/**"],
  overrides: [
    {
      files: ["*.astro"],
      parser: "astro-eslint-parser",
      parserOptions: { parser: "@typescript-eslint/parser", extraFileExtensions: [".astro"] },
    },
  ],
};
