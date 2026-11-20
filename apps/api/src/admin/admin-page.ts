/**
 * R430: the platform admin page — one self-contained document, no build step
 * and no dependencies. Its only script and stylesheet carry the request's
 * nonce, and the Content-Security-Policy sent with it allows nothing else, so
 * no injected markup can run. Everything a salon or the API supplies is put on
 * the page with textContent, never as HTML.
 */

export interface AdminPageConfig {
  /** Where salon owners sign in, for the hand-off note. */
  cmsUrl: string | null;
  /** e.g. "platform.ge": a salon's booking site is https://<subdomain>.<this>. */
  siteBaseDomain: string | null;
  siteProtocol: "https" | "http";
  /** R430: whether set-password links are emailed, or handed back to pass on. */
  mailConfigured: boolean;
}

/** The policy the page is sent with; `nonce` must be the one rendered into it. */
export function adminPageCsp(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    "connect-src 'self'",
    "img-src 'self' data:",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** JSON that can sit inside a <script> element without ending it. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export function renderAdminPage(nonce: string, config: AdminPageConfig): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Platform admin</title>
<style nonce="${nonce}">
:root { --ink:#15181b; --paper:#f2f3f0; --card:#fff; --rule:#d9dcd5; --muted:#5f666d; --accent:#ffe45c; --error:#c0362c; --ok:#2e7d4f; color-scheme: light; }
* { box-sizing: border-box; }
body { margin:0; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Georgian", sans-serif; background:var(--paper); color:var(--ink); }
header { display:flex; align-items:center; gap:12px; padding:14px 24px; border-bottom:1px solid var(--rule); background:var(--paper); }
header strong { font-size:17px; }
header .who { margin-left:auto; color:var(--muted); font-size:14px; }
main, #app, .page { display:grid; gap:20px; }
/* Grid items may shrink below their content, so a wide table scrolls inside its card instead of widening the page. */
#app > *, .page > * { min-width:0; }
main { max-width:980px; margin:0 auto; padding:24px 16px 64px; }
.card { background:var(--card); border:1px solid var(--rule); border-radius:8px; padding:20px; }
h1 { font-size:26px; margin:0 0 4px; } h2 { font-size:19px; margin:0 0 12px; }
p.hint { color:var(--muted); margin:0 0 16px; font-size:14px; }
.login { max-width:380px; margin:48px auto 0; }
.grid { display:grid; gap:14px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
label { display:flex; flex-direction:column; gap:5px; font-size:13px; font-weight:600; }
label small { font-weight:400; color:var(--muted); }
input { font:inherit; padding:9px 11px; border:1px solid var(--rule); border-radius:6px; background:#fff; color:var(--ink); min-width:0; }
input:focus { outline:2px solid var(--ink); outline-offset:1px; }
.row { display:flex; gap:8px; } .row input { flex:1; }
button { font:inherit; font-weight:600; padding:9px 14px; border-radius:6px; border:1px solid var(--ink); background:var(--ink); color:#fff; cursor:pointer; }
button.secondary { background:#fff; color:var(--ink); border-color:var(--rule); }
button.link { background:none; border:0; color:var(--muted); text-decoration:underline; padding:0; font-weight:500; }
button:disabled { opacity:.5; cursor:default; }
.actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
.error { color:var(--error); font-size:14px; margin:10px 0 0; }
.done { border-left:4px solid var(--ok); }
pre { background:var(--paper); border:1px solid var(--rule); border-radius:6px; padding:12px; white-space:pre-wrap; font-size:14px; margin:0 0 12px; }
table { width:100%; border-collapse:collapse; font-size:14px; }
th, td { text-align:left; padding:9px 8px; border-bottom:1px solid var(--rule); vertical-align:top; }
th { font-size:12px; color:var(--muted); font-weight:600; }
td a { color:var(--ink); }
.pill { display:inline-block; padding:1px 8px; border-radius:4px; font-size:12px; font-weight:600; background:var(--paper); border:1px solid var(--rule); }
.pill.finished { background:#e3f1e8; border-color:#b9dcc6; color:var(--ok); }
.pill.in_progress { background:var(--accent); border-color:var(--accent); }
.pill.active, .pill.free { background:#e3f1e8; border-color:#b9dcc6; color:var(--ok); }
.pill.past_due { background:var(--accent); border-color:var(--accent); }
.pill.lapsed { background:#f6e1df; border-color:#e6b9b4; color:var(--error); }
.plan small { display:block; color:var(--muted); font-size:12px; margin-top:2px; }
.plan .row { margin-top:6px; flex-wrap:wrap; }
.plan button { padding:3px 8px; font-size:12px; }
.scroll { overflow-x:auto; }
.plans input[type=text], .plans input[type=number] { width:96px; }
.plans input[type=checkbox] { width:18px; height:18px; margin:9px 0 0; }
.plans td { vertical-align:middle; }
.plans .note { display:block; color:var(--muted); font-size:12px; margin-top:4px; max-width:220px; }
.plans .note.warn { color:var(--ink); background:var(--accent); padding:2px 6px; border-radius:4px; }
.plans .note.bad { color:var(--error); }
.contacts td { vertical-align:top; }
.contacts .msg { max-width:320px; white-space:pre-wrap; overflow-wrap:anywhere; }
.contacts tr.handled td { color:var(--muted); }
fieldset { border:0; padding:0; margin:16px 0 0; display:grid; gap:8px; min-width:0; }
legend { font-size:13px; font-weight:600; padding:0; margin-bottom:6px; }
label.choice { flex-direction:row; align-items:center; gap:8px; font-weight:500; font-size:14px; }
label.choice input { margin:0; width:16px; height:16px; }
.owner small { display:block; color:var(--muted); font-size:12px; margin-top:4px; max-width:260px; word-break:break-all; }
.owner small.bad { color:var(--error); }
.owner button { padding:3px 8px; font-size:12px; }
nav.tabs { display:flex; gap:4px; padding:0 24px; border-bottom:1px solid var(--rule); background:var(--paper); overflow-x:auto; }
nav.tabs a { padding:11px 12px 9px; color:var(--muted); text-decoration:none; font-weight:600; font-size:14px; border-bottom:2px solid transparent; white-space:nowrap; }
nav.tabs a:hover { color:var(--ink); }
nav.tabs a[aria-current=page] { color:var(--ink); border-bottom-color:var(--ink); }
nav.tabs .count { display:inline-block; min-width:20px; margin-left:6px; padding:0 6px; border-radius:10px; background:var(--accent); color:var(--ink); font-size:12px; text-align:center; }
.pager { display:flex; align-items:center; justify-content:flex-end; gap:12px; margin-top:12px; font-size:14px; color:var(--muted); }
.pager button { padding:5px 10px; font-size:13px; }
.plans .names { display:grid; gap:4px; }
.plans .names input[type=text] { width:200px; }
.plans .actions-cell { white-space:nowrap; }
.plans .actions-cell .note { white-space:normal; }
.plans .actions-cell button + button { margin-left:6px; }
button.danger { background:#fff; color:var(--error); border-color:#e6b9b4; }
button.danger.armed { background:var(--error); color:#fff; border-color:var(--error); }
.add-plan { margin-top:24px; padding-top:20px; border-top:1px solid var(--rule); }
.add-plan h3 { font-size:16px; margin:0 0 12px; }
.add-plan .flags { display:flex; gap:20px; flex-wrap:wrap; margin-top:14px; }
[hidden] { display:none !important; }
</style>
</head>
<body>
<header>
  <strong>Booking platform · Admin</strong>
  <span class="who" id="who" hidden></span>
  <button class="link" id="signout" type="button" hidden>Sign out</button>
</header>
<nav class="tabs" id="tabs" aria-label="Admin sections" hidden>
  <a href="#salons" data-tab="salons">Salons</a>
  <a href="#new-salon" data-tab="new-salon">New salon</a>
  <a href="#contacts" data-tab="contacts">Contact requests<span class="count" id="contacts-count" hidden></span></a>
  <a href="#plans" data-tab="plans">Plans</a>
</nav>
<main>
  <section class="card login" id="login" hidden>
    <h1>Sign in</h1>
    <p class="hint">Platform staff only.</p>
    <form id="login-form" novalidate>
      <div class="grid">
        <label>Email <input id="login-email" type="email" autocomplete="username" required></label>
        <label>Password <input id="login-password" type="password" autocomplete="current-password" required></label>
      </div>
      <p class="error" id="login-error" role="alert" hidden></p>
      <div class="actions"><button type="submit" id="login-submit">Sign in</button></div>
    </form>
  </section>

  <section id="app" hidden>
   <div class="page" data-page="new-salon" hidden>
    <div class="card done" id="created" hidden>
      <h2>Salon created</h2>
      <p class="hint" id="created-hint"></p>
      <pre id="handoff"></pre>
      <div class="row"><button class="secondary" type="button" id="copy-handoff">Copy</button><button class="link" type="button" id="close-created">Close</button></div>
    </div>

    <div class="card">
      <h2>New salon</h2>
      <p class="hint">Creates the salon and its owner. The owner signs in to the CMS and is guided through the setup.</p>
      <form id="create-form" novalidate>
        <div class="grid">
          <label>Salon name <input id="f-name" required maxlength="120" autocomplete="off"></label>
          <label>Subdomain <small id="f-subdomain-hint">Lowercase letters, digits and hyphens</small>
            <input id="f-subdomain" required maxlength="63" pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?" autocomplete="off" spellcheck="false">
          </label>
          <label>Time zone <input id="f-timezone" required value="Asia/Tbilisi" list="zones" autocomplete="off" spellcheck="false"></label>
          <label>Owner email <input id="f-email" type="email" required autocomplete="off"></label>
        </div>
        <fieldset>
          <legend>Owner's password</legend>
          <label class="choice"><input type="radio" name="owner-access" id="f-access-link" value="link"> Email them a link to set it themselves</label>
          <label class="choice"><input type="radio" name="owner-access" id="f-access-password" value="password"> Set it now</label>
          <p class="hint" id="f-link-hint"></p>
          <label id="f-password-label" hidden>Password <small>At least 10 characters</small>
            <span class="row"><input id="f-password" minlength="10" autocomplete="new-password" spellcheck="false"><button class="secondary" type="button" id="generate">Generate</button></span>
          </label>
        </fieldset>
        <datalist id="zones"><option value="Asia/Tbilisi"><option value="Europe/Istanbul"><option value="Europe/Kyiv"><option value="Europe/Berlin"><option value="Europe/London"><option value="Asia/Yerevan"><option value="Asia/Baku"></datalist>
        <p class="error" id="create-error" role="alert" hidden></p>
        <div class="actions"><button type="submit" id="create-submit">Create salon</button></div>
      </form>
    </div>
   </div>

   <div class="page" data-page="contacts" hidden>
    <div class="card">
      <h2>Contact requests</h2>
      <p class="hint" id="contacts-hint">Businesses asking to get started, from the marketing site's contact page (R580). Newest first.</p>
      <div class="scroll">
        <table class="contacts">
          <thead><tr><th>Received</th><th>Name</th><th>Business</th><th>Phone</th><th>Email</th><th>Message</th><th>Language</th><th></th></tr></thead>
          <tbody id="contacts"></tbody>
        </table>
      </div>
      <p class="hint" id="contacts-empty" hidden>No requests yet.</p>
      <div class="pager" id="contacts-pager" hidden></div>
      <p class="error" id="contacts-error" role="alert" hidden></p>
    </div>
   </div>

   <div class="page" data-page="plans" hidden>
    <div class="card">
      <h2>Plans</h2>
      <p class="hint">What owners see and pay (R550). Changes apply at once to every salon on the plan: locations straight away, a new price from each salon's next renewal. Texts are unlimited on every plan. A plan that isn't offered can't be chosen, but salons already on it keep it. Leave locations empty for no limit. Names are shown in the owner's language; an empty Georgian or Russian name shows the English one. A plan can be deleted only if no salon has ever been on it or paid for it; otherwise stop offering it.</p>
      <div class="scroll">
        <table class="plans">
          <thead><tr><th>Name</th><th>Price ₾ / month</th><th>Locations</th><th>Priority support</th><th>Offered</th><th>Paying salons</th><th></th></tr></thead>
          <tbody id="plans"></tbody>
        </table>
      </div>
      <p class="error" id="plans-error" role="alert" hidden></p>

      <form class="add-plan" id="plan-form" novalidate>
        <h3>Add a plan</h3>
        <div class="grid">
          <label>Name in English <input id="p-name" required maxlength="60" autocomplete="off"></label>
          <label>Name in Georgian (optional) <input id="p-name-ka" maxlength="60" autocomplete="off" lang="ka"></label>
          <label>Name in Russian (optional) <input id="p-name-ru" maxlength="60" autocomplete="off" lang="ru"></label>
          <label>Price ₾ / month <input id="p-price" required inputmode="decimal" autocomplete="off"></label>
          <label>Locations <input id="p-locations" type="number" min="1" step="1" placeholder="No limit"></label>
        </div>
        <div class="flags">
          <label class="choice"><input type="checkbox" id="p-priority"> Priority support</label>
          <label class="choice"><input type="checkbox" id="p-offered"> Offered: owners can choose it now</label>
        </div>
        <p class="hint" id="p-offered-hint">Leave "Offered" unticked to check the plan here before owners and the marketing site see it.</p>
        <p class="error" id="plan-form-error" role="alert" hidden></p>
        <div class="actions"><button type="submit" id="plan-form-submit">Add plan</button></div>
      </form>
    </div>
   </div>

   <div class="page" data-page="salons" hidden>
    <div class="card">
      <h2>Salons</h2>
      <div class="scroll">
        <table>
          <thead><tr><th>Salon</th><th>Booking site</th><th>Time zone</th><th>Created</th><th>Setup</th><th>Subscription</th><th>Owner login</th></tr></thead>
          <tbody id="tenants"></tbody>
        </table>
      </div>
      <p class="hint" id="tenants-empty" hidden>No salons yet.</p>
      <div class="pager" id="tenants-pager" hidden></div>
      <p class="error" id="tenants-error" role="alert" hidden></p>
    </div>
   </div>
  </section>
</main>
<script nonce="${nonce}">
"use strict";
const CONFIG = ${scriptJson(config)};
const $ = (id) => document.getElementById(id);
// The anti-CSRF header on every call; a content type only with a body (an empty JSON body is refused).
const CSRF = { "x-requested-with": "booking-cms" };
const SETUP = { in_progress: "In progress", hidden: "Hidden by owner", finished: "Finished" };
// R480: subscription statuses and plans, as the admin reads them
const STATUS = { free: "Free", trial: "Trial", active: "Active", past_due: "Payment due", lapsed: "Booking paused" };
// R550: the plans as last loaded (they name themselves), and the salons (to count who pays for each)
let plans = [];
let tenantsSeen = [];
let contactsSeen = [];
// Long lists are paged rather than scrolled.
const PAGE_SIZE = 20;
const pages = { tenants: 1, contacts: 1 };
const PAGES = ["salons", "new-salon", "contacts", "plans"];

async function api(path, options) {
  const headers = options && options.body !== undefined ? { ...CSRF, "content-type": "application/json" } : CSRF;
  const response = await fetch("/admin/api/" + path, { credentials: "same-origin", ...options, headers });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && (Array.isArray(body.message) ? body.message.join(", ") : body.message);
    const error = new Error(response.status === 429 ? "Too many attempts. Try again later." : message || "Something went wrong (" + response.status + ")");
    error.status = response.status;
    throw error;
  }
  return body;
}

function siteUrl(subdomain) {
  return CONFIG.siteBaseDomain ? CONFIG.siteProtocol + "://" + subdomain + "." + CONFIG.siteBaseDomain : null;
}

function show(error, message) {
  error.textContent = message || "";
  error.hidden = !message;
}

// One section at a time, picked by the address's #fragment, so a reload stays put.
function showPage() {
  const wanted = location.hash.slice(1);
  const page = PAGES.includes(wanted) ? wanted : "salons";
  for (const section of document.querySelectorAll("[data-page]")) section.hidden = section.dataset.page !== page;
  for (const tab of document.querySelectorAll("[data-tab]")) {
    if (tab.dataset.tab === page) tab.setAttribute("aria-current", "page"); else tab.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", showPage);

/** The rows of \`items\` on page \`key\`, with the pager under the table showing where they are. */
function paged(key, items, pagerId, noun, rerender) {
  const count = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  pages[key] = Math.min(Math.max(1, pages[key]), count);
  const pager = $(pagerId);
  pager.hidden = items.length <= PAGE_SIZE;
  const button = (label, page) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "secondary"; b.textContent = label;
    b.disabled = page < 1 || page > count;
    b.addEventListener("click", () => { pages[key] = page; rerender(); pager.scrollIntoView({ block: "nearest" }); });
    return b;
  };
  const where = document.createElement("span");
  where.textContent = "Page " + pages[key] + " of " + count + " · " + items.length + " " + noun;
  pager.replaceChildren(button("Previous", pages[key] - 1), where, button("Next", pages[key] + 1));
  return items.slice((pages[key] - 1) * PAGE_SIZE, pages[key] * PAGE_SIZE);
}

function planLabel(id) {
  const plan = plans.find((candidate) => candidate.id === id);
  return plan ? plan.name : id;
}

function signedIn(session) {
  $("login").hidden = true;
  $("app").hidden = false;
  $("tabs").hidden = false;
  showPage();
  $("who").textContent = session.email;
  $("who").hidden = false;
  $("signout").hidden = false;
  loadTenants();
  loadPlans();
  loadContacts();
}

function signedOut() {
  $("app").hidden = true;
  $("tabs").hidden = true;
  $("who").hidden = true;
  $("signout").hidden = true;
  $("login").hidden = false;
  $("login-email").focus();
}

async function loadTenants() {
  show($("tenants-error"));
  try {
    tenantsSeen = await api("tenants");
    // Only the counts: a plan edit in progress must survive a salon list reload.
    for (const td of document.querySelectorAll("[data-paying]")) td.textContent = String(payingOn(td.dataset.paying));
    renderTenants();
  } catch (error) {
    if (error.status === 401) signedOut();
  }
}

function renderTenants() {
  const tenants = tenantsSeen;
  $("tenants").replaceChildren(...paged("tenants", tenants, "tenants-pager", tenants.length === 1 ? "salon" : "salons", renderTenants).map((tenant) => {
    const row = document.createElement("tr");
    const cell = (text) => { const td = document.createElement("td"); td.textContent = text; row.appendChild(td); return td; };
    cell(tenant.name);
    const site = cell("");
    const url = siteUrl(tenant.subdomain);
    if (url) {
      const link = document.createElement("a");
      link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = tenant.subdomain;
      site.appendChild(link);
    } else {
      site.textContent = tenant.subdomain;
    }
    cell(tenant.timezone);
    cell(new Date(tenant.createdAt).toLocaleDateString());
    const pill = document.createElement("span");
    pill.className = "pill " + tenant.setup;
    pill.textContent = SETUP[tenant.setup] || tenant.setup;
    cell("").appendChild(pill);
    row.appendChild(planCell(tenant));
    row.appendChild(ownerCell(tenant));
    return row;
  }));
  $("tenants-empty").hidden = tenants.length > 0;
}

// R430/R480: a salon's subscription, with free use and a longer trial one click away.
function planCell(tenant) {
  const td = document.createElement("td");
  td.className = "plan";
  const sub = tenant.subscription;
  const pill = document.createElement("span");
  pill.className = "pill " + sub.status;
  pill.textContent = STATUS[sub.status] || sub.status;
  td.appendChild(pill);
  const detail = document.createElement("small");
  const until = new Date(sub.accessUntil).toLocaleDateString();
  detail.textContent = sub.status === "free" ? "Never charged"
    : sub.status === "trial" ? "Trial until " + until
    : !sub.paidThrough ? "Trial ended " + until
    : planLabel(sub.planId) + " · paid until " + until;
  td.appendChild(detail);
  // R500: who is outgrowing their plan
  const texts = document.createElement("small");
  texts.textContent = "Texts this month: " + sub.smsThisMonth;
  td.appendChild(texts);
  const actions = document.createElement("div");
  actions.className = "row";
  const button = (label, body) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "secondary"; b.textContent = label;
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await api("tenants/" + encodeURIComponent(tenant.id) + "/subscription", { method: "POST", body: JSON.stringify(body) });
        loadTenants();
      } catch (error) {
        if (error.status === 401) { signedOut(); return; }
        b.disabled = false;
        alertError(error.message);
      }
    });
    actions.appendChild(b);
  };
  button(sub.free ? "End free use" : "Make free", { free: !sub.free });
  if (!sub.free) button("+14 days trial", { extendTrialDays: 14 });
  if (sub.status === "trial") button("End trial now", { endTrial: true });
  td.appendChild(actions);
  return td;
}

// R430: a fresh set-password link for the owner. Two clicks, since it emails them.
function ownerCell(tenant) {
  const td = document.createElement("td");
  td.className = "owner";
  const send = document.createElement("button");
  send.type = "button"; send.className = "secondary"; send.textContent = "Email password link";
  const note = document.createElement("small");
  note.hidden = true;
  const say = (text, bad) => { note.textContent = text; note.hidden = !text; note.className = bad ? "bad" : ""; };
  let confirming = false;
  send.addEventListener("click", async () => {
    if (!confirming) {
      confirming = true;
      send.textContent = "Confirm: email the owner";
      say(CONFIG.mailConfigured
        ? "Replaces any earlier link. Their current password keeps working until they use it."
        : "Email isn't set up on this server: you'll get the link to send yourself.");
      return;
    }
    send.disabled = true;
    try {
      const link = await api("tenants/" + encodeURIComponent(tenant.id) + "/owner-link", { method: "POST" });
      say(linkNote(link), !link.emailed);
    } catch (error) {
      if (error.status === 401) { signedOut(); return; }
      say(error.message, true);
    } finally {
      confirming = false;
      send.disabled = false;
      send.textContent = "Email password link";
    }
  });
  td.append(send, note);
  return td;
}

/** What happened to a set-password link: emailed, or the link itself to pass on. */
function linkNote(link) {
  const until = new Date(link.expiresAt).toLocaleDateString();
  return link.emailed
    ? "Emailed to " + link.email + ". The link works once, until " + until + "."
    : "Couldn't email " + link.email + ". Send them this link yourself (works once, until " + until + "): " + link.url;
}

// R580: requests from the marketing site's contact page
async function loadContacts() {
  show($("contacts-error"));
  try {
    contactsSeen = await api("contact-requests");
    renderContacts();
  } catch (error) {
    if (error.status === 401) { signedOut(); return; }
    show($("contacts-error"), error.message);
  }
}

function renderContacts() {
  const requests = contactsSeen;
  $("contacts").replaceChildren(...paged("contacts", requests, "contacts-pager", requests.length === 1 ? "request" : "requests", renderContacts).map(contactRow));
  $("contacts-empty").hidden = requests.length > 0;
  const open = requests.filter((request) => !request.handledAt).length;
  $("contacts-hint").textContent = "Businesses asking to get started, from the marketing site's contact page (R580). Newest first" + (requests.length ? " · " + open + " open." : ".");
  $("contacts-count").textContent = String(open);
  $("contacts-count").hidden = open === 0;
}

function contactRow(request) {
  const row = document.createElement("tr");
  if (request.handledAt) row.className = "handled";
  const cell = (text) => { const td = document.createElement("td"); td.textContent = text; row.appendChild(td); return td; };
  const link = (href, text) => { const a = document.createElement("a"); a.href = href; a.textContent = text; return a; };
  cell(new Date(request.createdAt).toLocaleString());
  cell(request.name);
  cell(request.business);
  cell("").appendChild(link("tel:" + request.phone.replace(/[^0-9+]/g, ""), request.phone));
  const email = cell("");
  if (request.email) email.appendChild(link("mailto:" + request.email, request.email));
  cell(request.message || "").className = "msg";
  cell(request.locale);
  const toggle = document.createElement("button");
  toggle.type = "button"; toggle.className = "secondary";
  toggle.textContent = request.handledAt ? "Reopen" : "Mark handled";
  toggle.addEventListener("click", async () => {
    toggle.disabled = true;
    try {
      const updated = await api("contact-requests/" + encodeURIComponent(request.id), { method: "POST", body: JSON.stringify({ handled: !request.handledAt }) });
      row.replaceWith(contactRow(updated));
      loadContacts();
    } catch (error) {
      toggle.disabled = false;
      if (error.status === 401) { signedOut(); return; }
      show($("contacts-error"), error.message);
    }
  });
  cell("").appendChild(toggle);
  return row;
}

// R550: the plans, edited in place
async function loadPlans() {
  show($("plans-error"));
  try {
    plans = await api("plans");
    renderPlans();
    // The salons name their plans; those names have just arrived.
    if (tenantsSeen.length) renderTenants();
  } catch (error) {
    if (error.status === 401) { signedOut(); return; }
    show($("plans-error"), error.message);
  }
}

function payingOn(id) {
  return tenantsSeen.filter((t) => !t.subscription.free && t.subscription.paidThrough && t.subscription.planId === id).length;
}

function renderPlans() {
  $("plans").replaceChildren(...plans.map(planRow));
}

function planRow(plan) {
  const row = document.createElement("tr");
  const cell = () => { const td = document.createElement("td"); row.appendChild(td); return td; };
  const field = (parent, type, value, label) => {
    const el = document.createElement("input");
    el.type = type; el.setAttribute("aria-label", label + " · " + plan.name);
    if (type === "checkbox") el.checked = value; else el.value = value;
    parent.appendChild(el);
    return el;
  };
  const input = (type, value, label) => field(cell(), type, value, label);
  const i18n = plan.nameI18n || {};
  const names = document.createElement("div");
  names.className = "names";
  cell().appendChild(names);
  const name = field(names, "text", plan.name, "Name in English");
  name.maxLength = 60; name.placeholder = "English";
  const nameKa = field(names, "text", i18n.ka || "", "Name in Georgian");
  nameKa.maxLength = 60; nameKa.placeholder = "Georgian (optional)"; nameKa.lang = "ka";
  const nameRu = field(names, "text", i18n.ru || "", "Name in Russian");
  nameRu.maxLength = 60; nameRu.placeholder = "Russian (optional)"; nameRu.lang = "ru";
  const price = input("text", plan.price, "Price");
  price.inputMode = "decimal";
  const locations = input("number", plan.maxLocations === null ? "" : String(plan.maxLocations), "Locations");
  locations.min = "1"; locations.step = "1"; locations.placeholder = "No limit";
  const priority = input("checkbox", plan.prioritySupport, "Priority support");
  const offered = input("checkbox", plan.offered, "Offered");
  const paying = cell();
  paying.dataset.paying = plan.id;
  paying.textContent = String(payingOn(plan.id));
  const actions = cell();
  actions.className = "actions-cell";
  const save = document.createElement("button");
  save.type = "button"; save.className = "secondary"; save.textContent = "Save";
  const remove = document.createElement("button");
  remove.type = "button"; remove.className = "danger"; remove.textContent = "Delete";
  const note = document.createElement("small");
  note.className = "note"; note.hidden = true;
  actions.append(save, remove, note);
  const say = (text, kind) => { note.textContent = text || ""; note.hidden = !text; note.className = "note" + (kind ? " " + kind : ""); };

  let confirming = false;
  let confirmingDelete = false;
  const disarmDelete = () => { confirmingDelete = false; remove.textContent = "Delete"; remove.classList.remove("armed"); };
  const changes = () => {
    const body = {};
    if (name.value.trim() !== plan.name) body.name = name.value.trim();
    const translations = {};
    if (nameKa.value.trim()) translations.ka = nameKa.value.trim();
    if (nameRu.value.trim()) translations.ru = nameRu.value.trim();
    if ((translations.ka || "") !== (i18n.ka || "") || (translations.ru || "") !== (i18n.ru || "")) {
      body.nameI18n = Object.keys(translations).length ? translations : null;
    }
    if (Number(price.value) !== Number(plan.price) || price.value.trim() === "") body.price = price.value.trim();
    const max = locations.value.trim() === "" ? null : Number(locations.value);
    if (max !== plan.maxLocations) body.maxLocations = max;
    if (priority.checked !== plan.prioritySupport) body.prioritySupport = priority.checked;
    if (offered.checked !== plan.offered) body.offered = offered.checked;
    return body;
  };
  // An edit after a "confirm" prompt asks again.
  for (const el of [name, nameKa, nameRu, price, locations, priority, offered]) {
    el.addEventListener("input", () => { confirming = false; save.textContent = "Save"; disarmDelete(); say(""); });
  }

  save.addEventListener("click", async () => {
    disarmDelete();
    const body = changes();
    if (Object.keys(body).length === 0) { say("Nothing changed."); return; }
    if (body.price !== undefined && !confirming) {
      const paying = payingOn(plan.id);
      confirming = true;
      save.textContent = "Confirm";
      say(paying + " paying salon" + (paying === 1 ? "" : "s") + " on this plan will be charged " + body.price + " ₾ from their next renewal. Click Confirm to save.", "warn");
      return;
    }
    save.disabled = true;
    try {
      const updated = await api("plans/" + encodeURIComponent(plan.id), { method: "POST", body: JSON.stringify(body) });
      plans = plans.map((p) => (p.id === updated.id ? updated : p));
      const fresh = planRow(updated);
      row.replaceWith(fresh);
      const freshNote = fresh.querySelector(".note");
      freshNote.textContent = "Saved."; freshNote.hidden = false;
      if (body.name !== undefined) renderTenants();
    } catch (error) {
      if (error.status === 401) { signedOut(); return; }
      save.disabled = false;
      confirming = false;
      save.textContent = "Save";
      say(error.message, "bad");
    }
  });

  // R550: two clicks, and the API refuses a plan any salon has used.
  remove.addEventListener("click", async () => {
    confirming = false; save.textContent = "Save";
    if (!confirmingDelete) {
      confirmingDelete = true;
      remove.textContent = "Confirm delete";
      remove.classList.add("armed");
      say("Deletes " + plan.name + " for good. Only possible if no salon has ever been on it or paid for it.", "warn");
      return;
    }
    remove.disabled = true;
    try {
      await api("plans/" + encodeURIComponent(plan.id), { method: "DELETE" });
      plans = plans.filter((p) => p.id !== plan.id);
      row.remove();
    } catch (error) {
      if (error.status === 401) { signedOut(); return; }
      remove.disabled = false;
      disarmDelete();
      say(error.message, "bad");
    }
  });
  return row;
}

// R550: a new plan, named in up to three languages; its id comes from the English name.
$("plan-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  show($("plan-form-error"));
  const translations = {};
  if ($("p-name-ka").value.trim()) translations.ka = $("p-name-ka").value.trim();
  if ($("p-name-ru").value.trim()) translations.ru = $("p-name-ru").value.trim();
  const locations = $("p-locations").value.trim();
  const request = {
    name: $("p-name").value.trim(),
    nameI18n: Object.keys(translations).length ? translations : null,
    price: $("p-price").value.trim(),
    maxLocations: locations === "" ? null : Number(locations),
    prioritySupport: $("p-priority").checked,
    offered: $("p-offered").checked,
  };
  if (!request.name) { show($("plan-form-error"), "Give the plan a name in English."); return; }
  if (!request.price) { show($("plan-form-error"), "Give the plan a monthly price."); return; }
  $("plan-form-submit").disabled = true;
  try {
    const created = await api("plans", { method: "POST", body: JSON.stringify(request) });
    plans = [...plans, created];
    const fresh = planRow(created);
    $("plans").appendChild(fresh);
    const freshNote = fresh.querySelector(".note");
    freshNote.textContent = "Added."; freshNote.hidden = false;
    $("plan-form").reset();
  } catch (error) {
    if (error.status === 401) { signedOut(); return; }
    show($("plan-form-error"), error.message);
  } finally {
    $("plan-form-submit").disabled = false;
  }
});

function alertError(message) {
  show($("tenants-error"), message);
}

// A subdomain suggested from a Latin salon name; the field stays editable.
let subdomainEdited = false;
$("f-subdomain").addEventListener("input", () => { subdomainEdited = true; preview(); });
$("f-name").addEventListener("input", () => {
  if (subdomainEdited) return;
  $("f-subdomain").value = $("f-name").value.normalize("NFKD").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63).replace(/-+$/g, "");
  preview();
});
function preview() {
  const url = $("f-subdomain").value && siteUrl($("f-subdomain").value);
  $("f-subdomain-hint").textContent = url || "Lowercase letters, digits and hyphens";
}

// R430: an emailed link by default when mail works; otherwise a password set now.
function ownerAccess() {
  return $("f-access-link").checked ? "link" : "password";
}
function showOwnerAccess() {
  const link = ownerAccess() === "link";
  $("f-password-label").hidden = link;
  $("f-password").required = !link;
  $("f-link-hint").textContent = !link ? ""
    : CONFIG.mailConfigured ? "They get an email in Georgian and English with a link to set their password (works once, for 7 days) and where to sign in."
    : "Email isn't set up on this server, so the link will be shown here for you to send them yourself (works once, for 7 days).";
  $("f-link-hint").hidden = !link;
}
function resetOwnerAccess() {
  $(CONFIG.mailConfigured ? "f-access-link" : "f-access-password").checked = true;
  showOwnerAccess();
}
$("f-access-link").addEventListener("change", showOwnerAccess);
$("f-access-password").addEventListener("change", showOwnerAccess);
resetOwnerAccess();

$("generate").addEventListener("click", () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  $("f-password").value = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
});

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  show($("login-error"));
  $("login-submit").disabled = true;
  try {
    const session = await api("login", { method: "POST", body: JSON.stringify({ email: $("login-email").value, password: $("login-password").value }) });
    $("login-password").value = "";
    signedIn(session);
  } catch (error) {
    show($("login-error"), error.message);
  } finally {
    $("login-submit").disabled = false;
  }
});

$("create-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  show($("create-error"));
  const byLink = ownerAccess() === "link";
  const request = {
    name: $("f-name").value,
    subdomain: $("f-subdomain").value.trim(),
    timezone: $("f-timezone").value.trim(),
    ownerEmail: $("f-email").value.trim(),
    ...(byLink ? { emailSetupLink: true } : { ownerPassword: $("f-password").value }),
  };
  $("create-submit").disabled = true;
  try {
    const created = await api("tenants", { method: "POST", body: JSON.stringify(request) });
    const link = created.setupLink;
    const lines = [
      "Salon: " + request.name.trim(),
      siteUrl(created.subdomain) ? "Booking site: " + siteUrl(created.subdomain) : null,
      CONFIG.cmsUrl ? "Sign in: " + CONFIG.cmsUrl : null,
      "Workspace: " + created.subdomain,
      "Email: " + created.ownerEmail,
      link ? (link.url ? "Set your password: " + link.url : "Password: set it from the emailed link") : "Password: " + request.ownerPassword,
    ].filter(Boolean);
    $("created-hint").textContent = !link
      ? "Send this to the owner now. The password isn't shown again; they can change it with 'Forgot password' on the sign-in page."
      : link.emailed
        ? linkNote(link) + " The details below are for your records."
        : "The email couldn't be sent. Send this to the owner yourself; the link works once, until " + new Date(link.expiresAt).toLocaleDateString() + ".";
    $("handoff").textContent = lines.join("\\n");
    $("created").hidden = false;
    $("create-form").reset();
    resetOwnerAccess();
    $("f-timezone").value = "Asia/Tbilisi";
    subdomainEdited = false;
    preview();
    loadTenants();
    $("created").scrollIntoView({ block: "nearest" });
  } catch (error) {
    if (error.status === 401) { signedOut(); return; }
    show($("create-error"), error.message);
  } finally {
    $("create-submit").disabled = false;
  }
});

$("copy-handoff").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("handoff").textContent); $("copy-handoff").textContent = "Copied"; } catch {}
});
$("close-created").addEventListener("click", () => {
  $("created").hidden = true;
  $("handoff").textContent = "";
  $("copy-handoff").textContent = "Copy";
});

$("signout").addEventListener("click", async () => {
  try { await api("logout", { method: "POST" }); } catch {}
  $("handoff").textContent = "";
  $("created").hidden = true;
  signedOut();
});

api("session").then(signedIn, signedOut);
</script>
</body>
</html>`;
}
