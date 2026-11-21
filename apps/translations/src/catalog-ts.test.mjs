// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { readTsEntries, setTsValues } from "./catalog-ts.mjs";

const SOURCE = `import type { Messages } from "./types";

// A comment that must survive.
export const en: Messages = {
  nav: { home: "Home", menu: 'Menu' },
  meta: {
    description:
      "A long line, wrapped by Prettier.",
  },
  proof: [
    { value: "24/7", label: "Bookings after hours" },
  ],
  plain: \`Back ticks\`,
  locations: (limit) => (limit === 1 ? "1 location" : \`Up to \${limit}\`),
  shared: SHARED,
};
`;

test("reads strings as text and everything else as code", () => {
  const entries = readTsEntries(SOURCE, "en.ts", "en");
  const byPath = Object.fromEntries(entries.map((entry) => [entry.path.join("."), entry]));
  assert.equal(byPath["nav.home"]?.value, "Home");
  assert.equal(byPath["nav.menu"]?.value, "Menu");
  assert.equal(byPath["meta.description"]?.value, "A long line, wrapped by Prettier.");
  assert.equal(byPath["proof.0.label"]?.value, "Bookings after hours");
  assert.equal(byPath["plain"]?.value, "Back ticks");
  assert.equal(byPath["locations"]?.editable, false);
  assert.match(byPath["locations"]?.code ?? "", /Up to/);
  assert.equal(byPath["shared"]?.code, "SHARED");
});

test("an edit replaces only that literal — every other character stays", () => {
  const next = setTsValues(SOURCE, "en.ts", "en", [{ path: ["meta", "description"], value: 'Now with "quotes"' }]);
  assert.equal(next, SOURCE.replace('"A long line, wrapped by Prettier."', '"Now with \\"quotes\\""'));
  const entry = readTsEntries(next, "en.ts", "en").find((item) => item.path.join(".") === "meta.description");
  assert.equal(entry?.value, 'Now with "quotes"');
});

test("text that looks like code stays text in a template literal", () => {
  const next = setTsValues(SOURCE, "en.ts", "en", [{ path: ["plain"], value: "Costs ${price} `now` \\ ok" }]);
  const entry = readTsEntries(next, "en.ts", "en").find((item) => item.path.join(".") === "plain");
  assert.equal(entry?.value, "Costs ${price} `now` \\ ok");
});

test("several edits in one go, including one language object of many", () => {
  const legal = `export const LEGAL = {\n  en: { title: "Privacy", items: ["One", "Two"] },\n  ka: { title: "კონფ", items: ["ერთი", "ორი"] },\n};\n`;
  const next = setTsValues(legal, "legal.ts", "LEGAL", [
    { key: "ka", path: ["items", "1"], value: "ორი!" },
    { key: "en", path: ["title"], value: "Privacy policy" },
    { key: "ka", path: ["title"], value: "კონფიდენციალურობა" },
  ]);
  assert.deepEqual(readTsEntries(next, "legal.ts", "LEGAL", "ka").map((entry) => entry.value), ["კონფიდენციალურობა", "ერთი", "ორი!"]);
  assert.deepEqual(readTsEntries(next, "legal.ts", "LEGAL", "en").map((entry) => entry.value), ["Privacy policy", "One", "Two"]);
});

test("code can't be edited, and paths can't be invented", () => {
  assert.throws(() => setTsValues(SOURCE, "en.ts", "en", [{ path: ["locations"], value: "x" }]), /No editable text/);
  assert.throws(() => setTsValues(SOURCE, "en.ts", "en", [{ path: ["nav", "new"], value: "x" }]), /No editable text/);
});
