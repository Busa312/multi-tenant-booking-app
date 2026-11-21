// @ts-check
import ts from "typescript";

/**
 * An entry of a TypeScript catalog: a catalog-json Entry plus, for a string
 * literal, where it sits in the source.
 * @typedef {import("./catalog-json.mjs").Entry & { start?: number; end?: number; template?: boolean }} TsEntry
 */

/**
 * The entries of an exported object literal (`export const en: Messages = {…}`),
 * or of its property `key`. String literals are editable; anything else — a
 * function, a reference to a constant, a template with `${…}` — is shown as
 * its code, to be changed in the code.
 * @param {string} text
 * @param {string} fileName
 * @param {string} exportName
 * @param {string} [key]
 * @returns {TsEntry[]}
 */
export function readTsEntries(text, fileName, exportName, key) {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let root = findExport(source, exportName);
  if (key !== undefined) {
    const property = root.properties.find((item) => ts.isPropertyAssignment(item) && propertyName(item.name) === key);
    const value = property && ts.isPropertyAssignment(property) ? unwrap(property.initializer) : undefined;
    if (!value || !ts.isObjectLiteralExpression(value)) {
      throw new Error(`${fileName}: ${exportName}.${key} is not an object literal`);
    }
    root = value;
  }
  /** @type {TsEntry[]} */
  const entries = [];
  walk(root, [], entries, source);
  return entries;
}

/**
 * @param {ts.SourceFile} source
 * @param {string} name
 * @returns {ts.ObjectLiteralExpression}
 */
function findExport(source, name) {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) {
        const value = unwrap(declaration.initializer);
        if (ts.isObjectLiteralExpression(value)) return value;
      }
    }
  }
  throw new Error(`${source.fileName}: no object literal named ${name}`);
}

/** `x as T`, `x satisfies T` and `(x)` all stand for `x`. @param {ts.Expression} node @returns {ts.Expression} */
function unwrap(node) {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) {
    return unwrap(node.expression);
  }
  return node;
}

/** @param {ts.PropertyName} name @returns {string | null} */
function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

/**
 * @param {ts.Node} node
 * @param {string[]} path
 * @param {TsEntry[]} out
 * @param {ts.SourceFile} source
 */
function walk(node, path, out, source) {
  const value = ts.isExpression(node) ? unwrap(node) : node;
  if (ts.isObjectLiteralExpression(value)) {
    for (const property of value.properties) {
      const name = ts.isPropertyAssignment(property) ? propertyName(property.name) : null;
      if (ts.isPropertyAssignment(property) && name !== null) {
        walk(property.initializer, [...path, name], out, source);
      } else {
        // A method, a spread or a shorthand: code, with whatever name it has.
        const label = property.name ? property.name.getText(source) : "…";
        out.push({ path: [...path, label], value: null, code: property.getText(source), editable: false });
      }
    }
  } else if (ts.isArrayLiteralExpression(value)) {
    value.elements.forEach((element, index) => walk(element, [...path, String(index)], out, source));
  } else if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    out.push({
      path,
      value: value.text,
      editable: true,
      start: value.getStart(source),
      end: value.getEnd(),
      template: ts.isNoSubstitutionTemplateLiteral(value),
    });
  } else {
    out.push({ path, value: null, code: value.getText(source), editable: false });
  }
}

/**
 * The literal that writes `value`: double quotes as the repo's Prettier
 * style has them, or backticks where the original used them.
 * @param {string} value
 * @param {boolean} template
 */
export function literalFor(value, template) {
  if (!template) return JSON.stringify(value);
  return `\`${value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
}

export const pathKey = (/** @type {string[]} */ path) => JSON.stringify(path);

/**
 * The source with new text in existing string literals — each literal
 * replaced in place, every other character of the file left as it was.
 * `edits` may reach into several language objects of the same file (`key`).
 * The result is parsed again and must read back exactly as intended, with no
 * syntax error and every other value unchanged, or nothing is returned.
 * @param {string} text
 * @param {string} fileName
 * @param {string} exportName
 * @param {{ key?: string; path: string[]; value: string }[]} edits
 * @returns {string}
 */
export function setTsValues(text, fileName, exportName, edits) {
  const keys = [...new Set(edits.map((edit) => edit.key))];
  /** @type {Map<string | undefined, Map<string, TsEntry>>} */
  const before = new Map(
    keys.map((key) => [key, new Map(readTsEntries(text, fileName, exportName, key).map((entry) => [pathKey(entry.path), entry]))]),
  );

  /** @type {{ start: number; end: number; literal: string }[]} */
  const replacements = [];
  for (const edit of edits) {
    const entry = before.get(edit.key)?.get(pathKey(edit.path));
    if (!entry || !entry.editable || entry.start === undefined || entry.end === undefined) {
      throw new Error(`No editable text at ${edit.path.join(".")}`);
    }
    replacements.push({ start: entry.start, end: entry.end, literal: literalFor(edit.value, entry.template === true) });
  }
  replacements.sort((a, b) => b.start - a.start);
  let next = text;
  for (const { start, end, literal } of replacements) next = next.slice(0, start) + literal + next.slice(end);

  const { diagnostics = [] } = ts.transpileModule(next, { fileName, reportDiagnostics: true });
  if (diagnostics.length > 0) {
    throw new Error(`${fileName}: the edit would not parse (${ts.flattenDiagnosticMessageText(diagnostics[0]?.messageText ?? "", " ")})`);
  }
  for (const key of keys) {
    const wanted = new Map([...(before.get(key) ?? [])].map(([id, entry]) => [id, entry.value ?? entry.code]));
    for (const edit of edits.filter((item) => item.key === key)) wanted.set(pathKey(edit.path), edit.value);
    const after = readTsEntries(next, fileName, exportName, key);
    const same =
      after.length === wanted.size && after.every((entry) => wanted.get(pathKey(entry.path)) === (entry.value ?? entry.code));
    if (!same) throw new Error(`${fileName}: the edit would not read back as written`);
  }
  return next;
}
