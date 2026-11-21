// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { comparePlaceholders, placeholders } from "../public/placeholders.mjs";

test("finds each slot once, sorted", () => {
  assert.deepEqual(placeholders("{name} and {count}, {name} again — {not a slot}"), ["{count}", "{name}"]);
});

test("a slot the English lacks is unknown; one it has but the translation leaves out is dropped", () => {
  assert.deepEqual(comparePlaceholders("Contact {salon} at {phone}", "Звоните: {phone} {oops}"), {
    unknown: ["{oops}"],
    dropped: ["{salon}"],
  });
});
