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
main, #app { display:grid; gap:20px; }
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
[hidden] { display:none !important; }
</style>
</head>
<body>
<header>
  <strong>Booking platform · Admin</strong>
  <span class="who" id="who" hidden></span>
  <button class="link" id="signout" type="button" hidden>Sign out</button>
</header>
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
    <div class="card done" id="created" hidden>
      <h2>Salon created</h2>
      <p class="hint">Send this to the owner now. The password isn't shown again; they can change it with "Forgot password" on the sign-in page.</p>
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
          <label>Owner password <small>At least 10 characters</small>
            <span class="row"><input id="f-password" required minlength="10" autocomplete="new-password" spellcheck="false"><button class="secondary" type="button" id="generate">Generate</button></span>
          </label>
        </div>
        <datalist id="zones"><option value="Asia/Tbilisi"><option value="Europe/Istanbul"><option value="Europe/Kyiv"><option value="Europe/Berlin"><option value="Europe/London"><option value="Asia/Yerevan"><option value="Asia/Baku"></datalist>
        <p class="error" id="create-error" role="alert" hidden></p>
        <div class="actions"><button type="submit" id="create-submit">Create salon</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Salons</h2>
      <div class="scroll">
        <table>
          <thead><tr><th>Salon</th><th>Booking site</th><th>Time zone</th><th>Created</th><th>Setup</th><th>Subscription</th></tr></thead>
          <tbody id="tenants"></tbody>
        </table>
      </div>
      <p class="hint" id="tenants-empty" hidden>No salons yet.</p>
      <p class="error" id="tenants-error" role="alert" hidden></p>
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
const PLAN = { early: "Early adopter", standard: "Standard", pro: "Pro" };

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

function signedIn(session) {
  $("login").hidden = true;
  $("app").hidden = false;
  $("who").textContent = session.email;
  $("who").hidden = false;
  $("signout").hidden = false;
  loadTenants();
}

function signedOut() {
  $("app").hidden = true;
  $("who").hidden = true;
  $("signout").hidden = true;
  $("login").hidden = false;
  $("login-email").focus();
}

async function loadTenants() {
  const body = $("tenants");
  show($("tenants-error"));
  try {
    const tenants = await api("tenants");
    body.replaceChildren(...tenants.map((tenant) => {
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
      return row;
    }));
    $("tenants-empty").hidden = tenants.length > 0;
  } catch (error) {
    if (error.status === 401) signedOut();
  }
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
    : (PLAN[sub.planId] || sub.planId) + " · paid until " + until;
  td.appendChild(detail);
  // R500: who is outgrowing their plan
  const texts = document.createElement("small");
  texts.textContent = "Texts " + sub.smsUsed + " / " + sub.smsIncluded + (sub.smsUsed > sub.smsIncluded ? " · over" : "");
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
  const request = {
    name: $("f-name").value,
    subdomain: $("f-subdomain").value.trim(),
    timezone: $("f-timezone").value.trim(),
    ownerEmail: $("f-email").value.trim(),
    ownerPassword: $("f-password").value,
  };
  $("create-submit").disabled = true;
  try {
    const created = await api("tenants", { method: "POST", body: JSON.stringify(request) });
    const lines = [
      "Salon: " + request.name.trim(),
      siteUrl(created.subdomain) ? "Booking site: " + siteUrl(created.subdomain) : null,
      CONFIG.cmsUrl ? "Sign in: " + CONFIG.cmsUrl : null,
      "Workspace: " + created.subdomain,
      "Email: " + created.ownerEmail,
      "Password: " + request.ownerPassword,
    ].filter(Boolean);
    $("handoff").textContent = lines.join("\\n");
    $("created").hidden = false;
    $("create-form").reset();
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
