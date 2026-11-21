// @ts-check
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { serializeJson } from "./catalog-json.mjs";
import { applyEdits, InputError, isLocked, loadCatalogs } from "./model.mjs";
import { REPO_ROOT, SOURCES } from "./sources.mjs";

/** @type {import("./sources.mjs").Source[]} */
const FIXTURE_SOURCES = [
  {
    id: "app",
    label: "App",
    hint: "",
    files: {
      en: { kind: "json", file: "en.json" },
      ka: { kind: "json", file: "ka.json" },
      ru: { kind: "json", file: "ru.json" },
    },
  },
];

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "translations-"));
  await writeFile(path.join(root, "en.json"), serializeJson({ hi: "Hello {name}", bye: "Bye" }));
  await writeFile(path.join(root, "ka.json"), serializeJson({ hi: "გამარჯობა {name}", bye: "Bye" }));
  await writeFile(path.join(root, "ru.json"), serializeJson({ hi: "Привет {name}" }));
});
after(() => rm(root, { recursive: true, force: true }));

test("rows have a cell per language, null where a file lacks the key", async () => {
  const { rows, errors } = await loadCatalogs(FIXTURE_SOURCES, root);
  assert.deepEqual(errors, []);
  const bye = rows.find((row) => row.path.join(".") === "bye");
  assert.equal(bye?.cells.ka?.value, "Bye");
  assert.equal(bye?.cells.ru, null);
});

test("saves when the file still says what the editor saw", async () => {
  const result = await applyEdits([{ source: "app", locale: "ka", path: ["bye"], from: "Bye", to: "ნახვამდის" }], FIXTURE_SOURCES, root);
  assert.deepEqual(result, { written: ["ka.json"], conflicts: [] });
  assert.equal(JSON.parse(await readFile(path.join(root, "ka.json"), "utf8")).bye, "ნახვამდის");
});

test("changed on disk meanwhile: nothing at all is written", async () => {
  const before = await readFile(path.join(root, "en.json"), "utf8");
  const result = await applyEdits(
    [
      { source: "app", locale: "en", path: ["bye"], from: "Bye", to: "Goodbye" },
      { source: "app", locale: "ka", path: ["bye"], from: "Bye", to: "stale" },
    ],
    FIXTURE_SOURCES,
    root,
  );
  assert.equal(result.conflicts.length, 1);
  assert.equal(await readFile(path.join(root, "en.json"), "utf8"), before);
});

test("refuses what the editor can't do: unknown catalogs, missing keys, odd input", async () => {
  const edit = { source: "app", locale: "en", path: ["bye"], from: "Bye", to: "x" };
  await assert.rejects(applyEdits([{ ...edit, source: "nope" }], FIXTURE_SOURCES, root), InputError);
  await assert.rejects(applyEdits([{ ...edit, locale: "de" }], FIXTURE_SOURCES, root), InputError);
  await assert.rejects(applyEdits([{ ...edit, locale: "ru" }], FIXTURE_SOURCES, root), InputError);
  await assert.rejects(applyEdits([{ ...edit, to: 5 }], FIXTURE_SOURCES, root), InputError);
});

test("the repo's real catalogs all load, every language present for every app", async () => {
  const { rows, errors } = await loadCatalogs(SOURCES, REPO_ROOT);
  assert.deepEqual(errors, []);
  for (const source of SOURCES) {
    const own = rows.filter((row) => row.source === source.id);
    assert.ok(own.length > 0, `${source.id} has strings`);
    assert.ok(own.some((row) => row.cells.en?.editable && row.cells.ka?.editable && row.cells.ru?.editable), `${source.id} is editable`);
  }
});

test("identifiers the code uses are shown, never edited", async () => {
  const marketing = /** @type {import("./sources.mjs").Source} */ (SOURCES.find((source) => source.id === "marketing"));
  assert.equal(isLocked(marketing, ["features", "items", "3", "icon"]), true);
  assert.equal(isLocked(marketing, ["features", "items", "3", "title"]), false);
  const { rows } = await loadCatalogs([marketing], REPO_ROOT);
  const icon = rows.find((row) => row.path.join(".") === "features.items.0.icon");
  assert.equal(icon?.cells.ka?.editable, false);
  const from = JSON.parse(icon?.cells.ka?.code ?? "null");
  await assert.rejects(
    applyEdits([{ source: "marketing", locale: "ka", path: ["features", "items", "0", "icon"], from, to: "x" }], [marketing], REPO_ROOT),
    InputError,
  );
});
