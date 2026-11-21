// @ts-check
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { readJsonEntries, setJsonValues } from "./catalog-json.mjs";
import { pathKey, readTsEntries, setTsValues } from "./catalog-ts.mjs";
import { LOCALES } from "./sources.mjs";

/** @typedef {import("./sources.mjs").Locale} Locale */
/** @typedef {import("./sources.mjs").Source} Source */
/** @typedef {import("./sources.mjs").LocaleFile} LocaleFile */

/**
 * One language's value of a key. null in a row: the key is missing from that
 * language's file.
 * @typedef {{ value: string | null; code?: string; editable: boolean }} Cell
 */

/**
 * @typedef {object} Row
 * @property {string} source
 * @property {string[]} path
 * @property {Record<Locale, Cell | null>} cells
 */

/**
 * A change asked for by the editor: the text it saw (`from`) and the text it
 * wants (`to`). `from` must still be what the file says, or nothing is saved.
 * @typedef {{ source: string; locale: Locale; path: string[]; from: string; to: string }} Edit
 */

/** Longest text the editor will write in one value. */
export const MAX_VALUE_LENGTH = 10_000;

/**
 * Whether `keys` is one of the source's locked paths (identifiers, not text).
 * @param {Source} source
 * @param {string[]} keys
 */
export function isLocked(source, keys) {
  return (source.locked ?? []).some((pattern) => {
    const parts = pattern.split(".");
    return parts.length === keys.length && parts.every((part, index) => part === "*" || part === keys[index]);
  });
}

/**
 * One language's entries of a source. A locked path is shown as code.
 * @param {string} root
 * @param {Source} source
 * @param {Locale} locale
 * @returns {Promise<{ path: string[]; value: string | null; code?: string; editable: boolean }[]>}
 */
async function readEntries(root, source, locale) {
  const file = source.files[locale];
  const text = await readFile(path.join(root, file.file), "utf8");
  const entries =
    file.kind === "json" ? readJsonEntries(text).entries : readTsEntries(text, file.file, file.exportName, file.key);
  return entries.map(({ path: keys, value, code, editable }) =>
    editable && isLocked(source, keys)
      ? { path: keys, value: null, code: JSON.stringify(value), editable: false }
      : { path: keys, value, code, editable },
  );
}

/**
 * Every catalog, as rows of one key with a cell per language, in the order of
 * the English file (keys only another language has come after).
 * @param {Source[]} sources
 * @param {string} root
 * @returns {Promise<{ rows: Row[]; errors: string[] }>}
 */
export async function loadCatalogs(sources, root) {
  /** @type {Row[]} */
  const rows = [];
  /** @type {string[]} */
  const errors = [];
  for (const source of sources) {
    /** @type {Map<string, Row>} */
    const byKey = new Map();
    for (const locale of LOCALES) {
      let entries;
      try {
        entries = await readEntries(root, source, locale);
      } catch (error) {
        errors.push(`${source.label} (${locale}): ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      for (const entry of entries) {
        const id = pathKey(entry.path);
        let row = byKey.get(id);
        if (!row) {
          row = { source: source.id, path: entry.path, cells: { en: null, ka: null, ru: null } };
          byKey.set(id, row);
        }
        row.cells[locale] = entry.code === undefined
          ? { value: entry.value, editable: entry.editable }
          : { value: entry.value, code: entry.code, editable: entry.editable };
      }
    }
    rows.push(...byKey.values());
  }
  return { rows, errors };
}

/**
 * Checks every edit against the files as they are now, then writes them —
 * all or nothing. Returns the edits whose text changed on disk since the
 * editor loaded it (`conflicts`); when there are any, nothing is written.
 * @param {unknown[]} input
 * @param {Source[]} sources
 * @param {string} root
 * @returns {Promise<{ written: string[]; conflicts: Edit[] }>}
 */
export async function applyEdits(input, sources, root) {
  const edits = input.map((item) => parseEdit(item, sources));

  // Group by file: the legal texts keep all three languages in one file.
  /** @type {Map<string, { file: LocaleFile; edits: { edit: Edit; key?: string }[] }>} */
  const byFile = new Map();
  for (const edit of edits) {
    const source = sources.find((item) => item.id === edit.source);
    if (!source) throw new InputError(`Unknown catalog ${edit.source}`);
    const file = source.files[edit.locale];
    const group = byFile.get(file.file) ?? { file, edits: [] };
    group.edits.push({ edit, key: file.kind === "ts" ? file.key : undefined });
    byFile.set(file.file, group);
  }

  /** @type {Edit[]} */
  const conflicts = [];
  /** @type {{ file: string; text: string }[]} */
  const outputs = [];
  for (const [name, group] of byFile) {
    const text = await readFile(path.join(root, name), "utf8");
    /** @type {Map<string, Map<string, { value: string | null; editable: boolean }>>} */
    const entriesByLocale = new Map();
    for (const { edit } of group.edits) {
      let entries = entriesByLocale.get(edit.locale);
      if (!entries) {
        const source = /** @type {Source} */ (sources.find((item) => item.id === edit.source));
        entries = new Map((await readEntries(root, source, edit.locale)).map((item) => [pathKey(item.path), item]));
        entriesByLocale.set(edit.locale, entries);
      }
      const entry = entries.get(pathKey(edit.path));
      if (!entry || !entry.editable) throw new InputError(`${edit.path.join(".")} can't be edited here`);
      if (entry.value !== edit.from) conflicts.push(edit);
    }
    if (conflicts.length > 0) continue;
    const changes = group.edits.map(({ edit, key }) => ({ key, path: edit.path, value: edit.to }));
    const next =
      group.file.kind === "json"
        ? setJsonValues(text, changes)
        : setTsValues(text, group.file.file, group.file.exportName, changes);
    outputs.push({ file: name, text: next });
  }
  if (conflicts.length > 0) return { written: [], conflicts };

  // Each file through a temporary one and a rename, so a file is never half written.
  for (const { file, text } of outputs) {
    const target = path.join(root, file);
    const temporary = `${target}.translations-${process.pid}.tmp`;
    await writeFile(temporary, text, "utf8");
    await rename(temporary, target);
  }
  return { written: outputs.map((output) => output.file), conflicts: [] };
}

/** A request the editor shouldn't have sent: answered 400. */
export class InputError extends Error {}

/**
 * @param {unknown} item
 * @param {Source[]} sources
 * @returns {Edit}
 */
function parseEdit(item, sources) {
  if (item === null || typeof item !== "object") throw new InputError("An edit must be an object");
  const { source, locale, path: keys, from, to } = /** @type {Record<string, unknown>} */ (item);
  if (typeof source !== "string" || !sources.some((entry) => entry.id === source)) {
    throw new InputError("Unknown catalog");
  }
  if (typeof locale !== "string" || !LOCALES.includes(/** @type {Locale} */ (locale))) {
    throw new InputError("Unknown language");
  }
  if (!Array.isArray(keys) || keys.length === 0 || !keys.every((key) => typeof key === "string")) {
    throw new InputError("An edit needs a path");
  }
  if (typeof from !== "string" || typeof to !== "string") throw new InputError("An edit needs from and to text");
  if (to.length > MAX_VALUE_LENGTH) throw new InputError(`Text longer than ${MAX_VALUE_LENGTH} characters`);
  return { source, locale: /** @type {Locale} */ (locale), path: keys, from, to };
}
