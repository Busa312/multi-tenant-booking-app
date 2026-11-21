// @ts-check

/**
 * One value of a catalog. `path` is the keys from the root (array indexes as
 * strings). Only plain strings are editable; anything else is shown as code.
 * @typedef {object} Entry
 * @property {string[]} path
 * @property {string | null} value  The text, or null when the value isn't a plain string.
 * @property {string} [code]        What stands there instead, for display.
 * @property {boolean} editable
 */

/** Pretty-printed the way the catalogs are checked in: two spaces, a final newline. */
export const serializeJson = (/** @type {unknown} */ data) => `${JSON.stringify(data, null, 2)}\n`;

/**
 * The entries of a JSON catalog. A file that wouldn't be written back exactly
 * as it reads (another indent, keys a JS object reorders) is read-only, so a
 * save can never reformat a whole file.
 * @param {string} text
 * @returns {{ entries: Entry[]; writable: boolean }}
 */
export function readJsonEntries(text) {
  const data = JSON.parse(text);
  const writable = serializeJson(data) === text;
  /** @type {Entry[]} */
  const entries = [];
  walk(data, [], entries, writable);
  return { entries, writable };
}

/**
 * @param {unknown} value
 * @param {string[]} path
 * @param {Entry[]} out
 * @param {boolean} writable
 */
function walk(value, path, out, writable) {
  if (typeof value === "string") {
    out.push({ path, value, editable: writable });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, [...path, String(index)], out, writable));
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) walk(item, [...path, key], out, writable);
  } else {
    out.push({ path, value: null, code: JSON.stringify(value), editable: false });
  }
}

/**
 * The catalog with new text at existing string paths. Throws for a path that
 * isn't already a string: the editor changes text, never the catalog's shape.
 * @param {string} text
 * @param {{ path: string[]; value: string }[]} edits
 * @returns {string}
 */
export function setJsonValues(text, edits) {
  const data = JSON.parse(text);
  for (const { path, value } of edits) {
    const last = path.at(-1);
    if (last === undefined) throw new Error("An edit needs a path");
    let parent = data;
    for (const key of path.slice(0, -1)) {
      parent = parent !== null && typeof parent === "object" ? parent[key] : undefined;
    }
    if (parent === null || typeof parent !== "object" || typeof parent[last] !== "string") {
      throw new Error(`No text at ${path.join(".")}`);
    }
    parent[last] = value;
  }
  return serializeJson(data);
}
