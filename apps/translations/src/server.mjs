// @ts-check
// The translation editor: a local page that shows every catalog side by side
// and writes changes back into the source files. Local only — it listens on
// 127.0.0.1 and is never deployed; a change reaches users the usual way, as
// a commit that is deployed.
//
//   pnpm translations        (or: pnpm --filter @booking/translations start)

import { readFile } from "node:fs/promises";
import http from "node:http";
import { applyEdits, InputError, loadCatalogs } from "./model.mjs";
import { LOCALES, REPO_ROOT, SOURCES } from "./sources.mjs";

const PORT = Number(process.env.PORT ?? 4800);
const HOST = "127.0.0.1";
const MAX_BODY = 2_000_000;

/** The page's own origins. A request naming any other host is refused (DNS rebinding). */
const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const ORIGINS = new Set([...HOSTS].map((host) => `http://${host}`));

/** Only these files are ever served. */
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/app.css": ["app.css", "text/css; charset=utf-8"],
  "/placeholders.mjs": ["placeholders.mjs", "text/javascript; charset=utf-8"],
};

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

/**
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
  res.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** @param {http.IncomingMessage} req @returns {Promise<unknown>} */
async function readJsonBody(req) {
  /** @type {Buffer[]} */
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new InputError("Request too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new InputError("Not JSON");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!HOSTS.has(req.headers.host ?? "")) {
      res.writeHead(421, SECURITY_HEADERS).end();
      return;
    }
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname in STATIC) {
      const [file, type] = STATIC[/** @type {keyof typeof STATIC} */ (url.pathname)];
      const body = await readFile(new URL(`../public/${file}`, import.meta.url));
      res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": type });
      res.end(body);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/catalogs") {
      const { rows, errors } = await loadCatalogs(SOURCES, REPO_ROOT);
      sendJson(res, 200, {
        locales: LOCALES,
        sources: SOURCES.map(({ id, label, hint, files }) => ({
          id,
          label,
          hint,
          files: [...new Set(Object.values(files).map((file) => file.file))],
        })),
        rows,
        errors,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/save") {
      // Only this page may write: a custom header (which another site can't
      // send without a CORS preflight we never answer) and our own origin.
      const origin = req.headers.origin;
      if (req.headers["x-requested-with"] !== "booking-translations" || (origin !== undefined && !ORIGINS.has(origin))) {
        sendJson(res, 403, { message: "Forbidden" });
        return;
      }
      if (!(req.headers["content-type"] ?? "").startsWith("application/json")) {
        sendJson(res, 415, { message: "Send JSON" });
        return;
      }
      const body = await readJsonBody(req);
      const edits = body !== null && typeof body === "object" ? /** @type {{ edits?: unknown }} */ (body).edits : undefined;
      if (!Array.isArray(edits) || edits.length === 0) throw new InputError("Nothing to save");
      const result = await applyEdits(edits, SOURCES, REPO_ROOT);
      if (result.conflicts.length > 0) {
        sendJson(res, 409, { message: "Changed on disk since you loaded it", conflicts: result.conflicts });
        return;
      }
      console.log(`Saved ${edits.length} change(s) to ${result.written.join(", ")}`);
      sendJson(res, 200, { saved: edits.length, files: result.written });
      return;
    }

    sendJson(res, 404, { message: "Not found" });
  } catch (error) {
    if (error instanceof InputError) {
      sendJson(res, 400, { message: error.message });
      return;
    }
    console.error(error);
    sendJson(res, 500, { message: error instanceof Error ? error.message : "Something went wrong" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Translations: http://localhost:${PORT}`);
  console.log("Saving writes into the apps' source files — review the diff, commit and deploy to publish.");
});
