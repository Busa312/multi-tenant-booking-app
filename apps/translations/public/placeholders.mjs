// @ts-check
// Shared by the server and the page: the `{name}` slots a string fills in at
// runtime. A slot the English doesn't have is printed as is ("{name}"), so
// a translation may only use the English text's slots.

/** @param {string} text @returns {string[]} the distinct slots, sorted */
export function placeholders(text) {
  return [...new Set(text.match(/\{[A-Za-z_]\w*\}/g) ?? [])].sort();
}

/**
 * How a translation's slots differ from the English: `unknown` ones the app
 * would print as they are (a bug), `dropped` ones it leaves out (fine when
 * the sentence was rephrased, e.g. to avoid declining a name).
 * @param {string} english
 * @param {string} translation
 */
export function comparePlaceholders(english, translation) {
  const wanted = placeholders(english);
  const used = placeholders(translation);
  return {
    unknown: used.filter((slot) => !wanted.includes(slot)),
    dropped: wanted.filter((slot) => !used.includes(slot)),
  };
}

/** @param {string} a @param {string} b */
export function samePlaceholders(a, b) {
  return placeholders(a).join(" ") === placeholders(b).join(" ");
}
