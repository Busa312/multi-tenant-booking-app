// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { readJsonEntries, serializeJson, setJsonValues } from "./catalog-json.mjs";

const TEXT = serializeJson({ common: { back: "Back", price: "{price} ₾" }, list: ["a", "b"], flag: true });

test("flattens nested text, arrays included; non-text is read-only", () => {
  const { entries, writable } = readJsonEntries(TEXT);
  assert.equal(writable, true);
  assert.deepEqual(
    entries.map((entry) => [entry.path.join("."), entry.value, entry.editable]),
    [
      ["common.back", "Back", true],
      ["common.price", "{price} ₾", true],
      ["list.0", "a", true],
      ["list.1", "b", true],
      ["flag", null, false],
    ],
  );
});

test("a file that wouldn't be written back as it reads is read-only", () => {
  const { entries, writable } = readJsonEntries('{"a": "b"}');
  assert.equal(writable, false);
  assert.equal(entries[0]?.editable, false);
});

test("sets existing text and keeps the layout; refuses new keys", () => {
  const next = setJsonValues(TEXT, [{ path: ["common", "back"], value: "Go back" }]);
  assert.equal(next, TEXT.replace('"Back"', '"Go back"'));
  assert.throws(() => setJsonValues(TEXT, [{ path: ["common", "new"], value: "x" }]), /No text/);
  assert.throws(() => setJsonValues(TEXT, [{ path: ["flag"], value: "x" }]), /No text/);
});
