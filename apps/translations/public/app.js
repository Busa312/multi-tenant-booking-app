// @ts-check
// The editor page. Everything shown is set as text (textContent / value) —
// catalog strings never become markup.
import { comparePlaceholders, samePlaceholders } from "./placeholders.mjs";

/** @typedef {"en" | "ka" | "ru"} Locale */
/** @typedef {{ value: string | null; code?: string; editable: boolean }} Cell */
/** @typedef {{ source: string; path: string[]; cells: Record<Locale, Cell | null> }} Row */
/** @typedef {{ id: string; label: string; hint: string; files: string[] }} Source */
/** @typedef {{ source: string; locale: Locale; path: string[]; from: string; to: string }} Edit */
/** @typedef {"all" | "missing" | "same" | "placeholders" | "unsaved"} Issue */

const LOCALES = /** @type {const} */ (["en", "ka", "ru"]);
const LOCALE_NAMES = { en: "English", ka: "ქართული", ru: "Русский" };
const PAGE = 120;

const ISSUES = /** @type {{ id: Issue; label: string; title: string }[]} */ ([
  { id: "all", label: "All", title: "Every string" },
  { id: "missing", label: "Missing", title: "Empty in a language, or missing from its file" },
  { id: "same", label: "Same as English", title: "Georgian or Russian still reads exactly like the English" },
  { id: "placeholders", label: "Placeholders", title: "A translation's {slots} differ from the English: an unknown one is printed as is; a dropped one is fine if the sentence was rephrased" },
  { id: "unsaved", label: "Unsaved", title: "Changed here, not yet saved" },
]);

const state = {
  /** @type {Row[]} */ rows: [],
  /** @type {Source[]} */ sources: [],
  /** @type {Map<string, Edit>} */ edits: new Map(),
  source: "all",
  /** @type {Issue} */ issue: "all",
  query: "",
  shown: PAGE,
  saving: false,
};

/** @param {string} id @returns {HTMLElement} */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Partial<Record<string, string>>} [attrs]
 * @param {(Node | string | null | false)[]} [children]
 * @returns {HTMLElementTagNameMap[K]}
 */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(name, value);
  for (const child of children) if (child) node.append(child);
  return node;
}

const rowId = (/** @type {Row} */ row) => `${row.source}\u0000${JSON.stringify(row.path)}`;
const editId = (/** @type {Row} */ row, /** @type {Locale} */ locale) => `${rowId(row)}\u0000${locale}`;

/** "hero.title.before", with array items as [0]. @param {string[]} path */
const showPath = (path) => path.map((key, index) => (/^\d+$/.test(key) ? `[${key}]` : index ? `.${key}` : key)).join("");

/** The text a cell shows now: the unsaved edit, else the file's. */
function current(/** @type {Row} */ row, /** @type {Locale} */ locale) {
  return state.edits.get(editId(row, locale))?.to ?? row.cells[locale]?.value ?? null;
}

/** Whether a translation in the row uses a slot the English doesn't have (printed as is: a bug). */
function hasUnknownSlot(/** @type {Row} */ row) {
  const en = current(row, "en");
  return (
    en !== null &&
    ["ka", "ru"].some((locale) => {
      const value = current(row, /** @type {Locale} */ (locale));
      return value !== null && comparePlaceholders(en, value).unknown.length > 0;
    })
  );
}

/** Which issues a row has, from the text as it is now (edits included). @returns {Set<Issue>} */
function issuesOf(/** @type {Row} */ row) {
  /** @type {Set<Issue>} */
  const found = new Set();
  const en = current(row, "en");
  for (const locale of LOCALES) {
    const cell = row.cells[locale];
    const value = current(row, locale);
    if (!cell) found.add("missing");
    else if (cell.editable && value !== null && value.trim() === "" && en?.trim()) found.add("missing");
    if (state.edits.has(editId(row, locale))) found.add("unsaved");
    if (locale === "en" || en === null || value === null) continue;
    // A string with no letters ("{price} ₾") reads the same in every language.
    if (value === en && /\p{L}{2,}/u.test(en.replace(/\{\w+\}/g, ""))) found.add("same");
    if (!samePlaceholders(en, value)) found.add("placeholders");
  }
  return found;
}

function matches(/** @type {Row} */ row) {
  if (state.source !== "all" && row.source !== state.source) return false;
  if (state.issue !== "all" && !issuesOf(row).has(state.issue)) return false;
  if (!state.query) return true;
  const query = state.query.toLocaleLowerCase();
  if (showPath(row.path).toLocaleLowerCase().includes(query)) return true;
  return LOCALES.some((locale) => (current(row, locale) ?? row.cells[locale]?.code ?? "").toLocaleLowerCase().includes(query));
}

/* ---------- rendering ---------- */

function renderFilters() {
  const sourceBox = $("sources");
  sourceBox.replaceChildren(
    ...[{ id: "all", label: "All apps", hint: "Every catalog" }, ...state.sources].map((source) => {
      const count = state.rows.filter((row) => source.id === "all" || row.source === source.id).length;
      const button = el("button", { type: "button", class: "chip", title: source.hint, "aria-pressed": String(state.source === source.id) }, [
        source.label,
        el("span", { class: "count" }, [String(count)]),
      ]);
      button.addEventListener("click", () => {
        state.source = source.id;
        state.shown = PAGE;
        render();
      });
      return button;
    }),
  );

  const inSource = state.rows.filter((row) => state.source === "all" || row.source === state.source);
  const issueBox = $("issues");
  issueBox.replaceChildren(
    ...ISSUES.map((issue) => {
      const count = issue.id === "all" ? inSource.length : inSource.filter((row) => issuesOf(row).has(issue.id)).length;
      const button = el("button", { type: "button", class: "chip", title: issue.title, "aria-pressed": String(state.issue === issue.id) }, [
        issue.label,
        el("span", { class: "count" }, [String(count)]),
      ]);
      button.addEventListener("click", () => {
        state.issue = issue.id;
        state.shown = PAGE;
        render();
      });
      return button;
    }),
  );
}

/** @param {Row} row */
function renderTags(row) {
  const source = state.sources.find((item) => item.id === row.source);
  const issues = issuesOf(row);
  return el("div", { class: "tags" }, [
    el("span", { class: "tag", title: source?.files.join("\n") ?? "" }, [source?.label ?? row.source]),
    issues.has("missing") && el("span", { class: "tag warn" }, ["missing"]),
    issues.has("placeholders") &&
      el("span", { class: hasUnknownSlot(row) ? "tag warn" : "tag" }, [hasUnknownSlot(row) ? "unknown placeholder" : "drops a placeholder"]),
    issues.has("same") && el("span", { class: "tag" }, ["same as English"]),
    issues.has("unsaved") && el("span", { class: "tag unsaved" }, ["unsaved"]),
  ]);
}

const autosize = CSS.supports("field-sizing", "content")
  ? () => {}
  : (/** @type {HTMLTextAreaElement} */ area) => {
      area.style.height = "auto";
      area.style.height = `${Math.min(area.scrollHeight + 2, 320)}px`;
    };

/** @param {Row} row @param {Locale} locale @param {{ tags: HTMLElement }} slot the row's tags, shared by its cells */
function renderCell(row, locale, slot) {
  const cell = row.cells[locale];
  const box = el("div", { class: "cell", "data-label": LOCALE_NAMES[locale] });
  if (!cell) {
    box.append(el("div", { class: "missing" }, ["Missing from this language's file — add the key in code."]));
    return box;
  }
  if (!cell.editable) {
    box.append(el("div", { class: "code", title: "Code, not text — change it in the file" }, [cell.code ?? cell.value ?? ""]));
    return box;
  }
  const area = el("textarea", { lang: locale, rows: "1", spellcheck: "true", "aria-label": `${showPath(row.path)} — ${LOCALE_NAMES[locale]}` });
  const hint = el("p", { class: "hint" });
  area.value = current(row, locale) ?? "";

  const refresh = () => {
    const edit = state.edits.get(editId(row, locale));
    area.classList.toggle("changed", edit !== undefined);
    const en = current(row, "en");
    const { unknown, dropped } = locale !== "en" && en !== null ? comparePlaceholders(en, area.value) : { unknown: [], dropped: [] };
    area.classList.toggle("warn", unknown.length > 0);
    hint.classList.toggle("soft", unknown.length === 0);
    hint.textContent =
      unknown.length > 0
        ? `${unknown.join(" ")} isn't in the English — the app would print it as is.`
        : dropped.length > 0
          ? `Doesn't use ${dropped.join(" ")} — fine if the sentence was rephrased.`
          : "";
    hint.hidden = hint.textContent === "";
  };
  area.addEventListener("input", () => {
    const from = cell.value ?? "";
    if (area.value === from) state.edits.delete(editId(row, locale));
    else state.edits.set(editId(row, locale), { source: row.source, locale, path: row.path, from, to: area.value });
    autosize(area);
    refresh();
    const tags = renderTags(row);
    slot.tags.replaceWith(tags);
    slot.tags = tags;
    // English sets the slots the other two must keep.
    if (locale === "en") area.closest(".row")?.querySelectorAll("textarea").forEach((other) => other !== area && other.dispatchEvent(new Event("refresh")));
    renderSaveBar();
  });
  area.addEventListener("refresh", refresh);
  refresh();
  box.append(area, hint);
  queueMicrotask(() => autosize(area));
  return box;
}

/** @param {Row} row */
function renderRow(row) {
  // Each cell replaces the row's tags as it changes, so they share one slot.
  const slot = { tags: renderTags(row) };
  const key = el("div", { class: "key" }, [el("span", { class: "key-path" }, [showPath(row.path)]), slot.tags]);
  const line = el("div", { class: "row" }, [key]);
  for (const locale of LOCALES) line.append(renderCell(row, locale, slot));
  return line;
}

function render() {
  renderFilters();
  const visible = state.rows.filter(matches);
  $("rows").replaceChildren(...visible.slice(0, state.shown).map(renderRow));
  $("table").hidden = visible.length === 0;
  $("empty").hidden = visible.length > 0;
  const more = $("more");
  more.hidden = visible.length <= state.shown;
  more.textContent = `Show more (${visible.length - state.shown} left)`;
  renderSaveBar();
}

function renderSaveBar() {
  const count = state.edits.size;
  $("savebar").hidden = count === 0;
  $("dirty-count").textContent = count === 1 ? "1 unsaved change." : `${count} unsaved changes.`;
  /** @type {HTMLButtonElement} */ ($("save")).disabled = state.saving;
  /** @type {HTMLButtonElement} */ ($("discard")).disabled = state.saving;
}

/** @param {string} message */
function toast(message) {
  const box = $("toast");
  box.textContent = message;
  box.hidden = false;
  clearTimeout(Number(box.dataset.timer));
  box.dataset.timer = String(setTimeout(() => (box.hidden = true), 6000));
}

/* ---------- data ---------- */

/**
 * Loads the catalogs from disk. Unsaved edits are kept where the file still
 * says what they were made against; the others are dropped and named.
 */
async function load() {
  const response = await fetch("/api/catalogs");
  if (!response.ok) throw new Error(`Couldn't read the catalogs (${response.status})`);
  const data = /** @type {{ rows: Row[]; sources: Source[]; errors: string[] }} */ (await response.json());
  state.rows = data.rows;
  state.sources = data.sources;

  /** @type {string[]} */
  const dropped = [];
  const byId = new Map(state.rows.map((row) => [rowId(row), row]));
  for (const [id, edit] of state.edits) {
    const row = byId.get(`${edit.source}\u0000${JSON.stringify(edit.path)}`);
    if (row?.cells[edit.locale]?.value !== edit.from) {
      state.edits.delete(id);
      dropped.push(`${showPath(edit.path)} (${edit.locale})`);
    }
  }

  const errors = $("errors");
  errors.hidden = data.errors.length === 0;
  errors.textContent = data.errors.join("\n");
  $("loading").hidden = true;
  render();
  return dropped;
}

async function save() {
  if (state.edits.size === 0 || state.saving) return;
  state.saving = true;
  renderSaveBar();
  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "booking-translations" },
      body: JSON.stringify({ edits: [...state.edits.values()] }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 409) {
      const dropped = await load();
      toast(`Nothing was saved: these changed on disk since you loaded them, so your edits to them were dropped:\n${dropped.join("\n")}\nYour other edits are kept — save again.`);
      return;
    }
    if (!response.ok) throw new Error(body.message ?? `Save failed (${response.status})`);
    state.edits.clear();
    await load();
    toast(`Saved ${body.saved} change${body.saved === 1 ? "" : "s"} to:\n${body.files.join("\n")}\nCommit and deploy to publish.`);
  } catch (error) {
    toast(error instanceof Error ? error.message : "Save failed");
  } finally {
    state.saving = false;
    renderSaveBar();
  }
}

/* ---------- wiring ---------- */

let searchTimer = 0;
$("search").addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    state.query = /** @type {HTMLInputElement} */ (event.target).value.trim();
    state.shown = PAGE;
    render();
  }, 150);
});
$("more").addEventListener("click", () => {
  state.shown += PAGE;
  render();
});
$("save").addEventListener("click", save);
$("discard").addEventListener("click", () => {
  if (!confirm(`Discard ${state.edits.size} unsaved change(s)?`)) return;
  state.edits.clear();
  render();
});
$("reload").addEventListener("click", async () => {
  const dropped = await load();
  toast(dropped.length ? `Reloaded. These edits no longer matched the files and were dropped:\n${dropped.join("\n")}` : "Reloaded from disk.");
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void save();
  }
});
window.addEventListener("beforeunload", (event) => {
  if (state.edits.size > 0) event.preventDefault();
});
// The table's header row sticks under the page header, whatever its height.
new ResizeObserver(([entry]) => {
  if (entry) document.documentElement.style.setProperty("--header-height", `${entry.target.getBoundingClientRect().height}px`);
}).observe(/** @type {Element} */ (document.querySelector(".top")));

load().catch((error) => {
  $("loading").hidden = true;
  const errors = $("errors");
  errors.hidden = false;
  errors.textContent = error instanceof Error ? error.message : String(error);
});
