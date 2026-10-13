// PROTOTYPE, throwaway. Stub of POST /api/v1/import for checking the iPhone
// Shortcut on a real device. No deps: `node prototypes/ios-shortcut/stub.ts`
// (Node 24 strips the types). State is in memory only.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 8787);
const LIMIT = 6 * 1024 * 1024; // the contract's route body limit

type Mode = keyof typeof MODES;
const MODES = {
  imported: { status: 201, body: { status: "imported", recipeId: "r1", title: "Chicken tikka masala", needsReview: true, run: "complete", message: 'Saved "Chicken tikka masala". 4 lines to check in Finders Eaters.' } },
  partial: { status: 201, body: { status: "imported", recipeId: "r1", title: "Chicken tikka masala", needsReview: false, run: "partial", message: 'Saved "Chicken tikka masala". Still being read.' } },
  duplicate: { status: 200, body: { status: "duplicate", recipeId: "r1", title: "Chicken tikka masala", message: 'Already in your library: "Chicken tikka masala".' } },
  bad_request: { status: 400, body: { error: "bad_request", message: "That share didn't include a link." } },
  invalid_token: { status: 401, body: { error: "invalid_token", message: "This Shortcut's import key no longer works. Make a new one in Finders Eaters: Settings, Import from iPhone." } },
  too_large: { status: 413, body: { error: "too_large", message: "That page is too big to send. Use Paste a link in Finders Eaters instead." } },
  unreadable: { status: 422, body: { error: "unreadable", reason: "no_recipe", message: "Couldn't find a recipe on that page. You can type it in." } },
  update_shortcut: { status: 426, body: { error: "update_shortcut", message: "This Shortcut is out of date. Get the new one in Finders Eaters: Settings, Import from iPhone." } },
  rate_limited: { status: 429, body: { error: "rate_limited", message: "Too many imports this hour. Try again later." } },
  proxy_html_502: { status: 502, body: null }, // non-JSON body, like a proxy error page
  empty_204: { status: 204, body: null },
  slow_20s: { status: 201, body: null, delayMs: 20_000 },
  slow_45s: { status: 201, body: null, delayMs: 45_000 },
  slow_90s: { status: 201, body: null, delayMs: 90_000 },
} as const satisfies Record<string, { status: number; body: unknown; delayMs?: number }>;

let mode: Mode = "imported";
const log: Array<Record<string, unknown>> = [];

const send = (res: ServerResponse, status: number, body: string, type = "application/json") => {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
};

async function readBody(req: IncomingMessage): Promise<{ bytes: number; text: string | null }> {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes <= LIMIT) chunks.push(chunk);
  }
  return { bytes, text: bytes <= LIMIT ? Buffer.concat(chunks).toString("utf8") : null };
}

async function handleImport(req: IncomingMessage, res: ServerResponse) {
  const t0 = Date.now();
  const auth = req.headers.authorization ?? "";
  const { bytes, text } = await readBody(req);
  let parsed: any = null;
  let parseError: string | null = null;
  if (text !== null) {
    try { parsed = JSON.parse(text); } catch (e) { parseError = String(e).slice(0, 120); }
  }
  const entry = {
    at: new Date().toISOString(),
    mode,
    bytes,
    readMs: Date.now() - t0,
    contentType: req.headers["content-type"],
    tokenOk: /^Bearer fe_imp_[A-Za-z0-9_-]+$/.test(auth),
    userAgent: req.headers["user-agent"],
    keys: parsed && typeof parsed === "object" ? Object.keys(parsed) : null,
    url: parsed?.url,
    client: parsed?.client,
    htmlChars: typeof parsed?.html === "string" ? parsed.html.length : null,
    htmlHasLdJson: typeof parsed?.html === "string" ? parsed.html.includes("application/ld+json") : null,
    probe: parsed?.probe ?? null,
    parseError,
  };
  log.unshift(entry);
  console.log(JSON.stringify(entry));

  if (bytes > LIMIT) return send(res, 413, JSON.stringify(MODES.too_large.body));
  const m = MODES[mode];
  if ("delayMs" in m) await new Promise((r) => setTimeout(r, m.delayMs));
  if (m.status === 204) { res.writeHead(204); return res.end(); }
  if (m.body === null && m.status === 502) return send(res, 502, "<html><body><h1>502 Bad Gateway</h1></body></html>", "text/html");
  const body = m.body ?? { ...MODES.imported.body, message: `Saved after ${(m as { delayMs: number }).delayMs / 1000} s.` };
  return send(res, m.status, JSON.stringify(body));
}

// A recipe page of roughly `mb` megabytes. pad=junk pads with scripts, styles
// and SVG (what capture.js strips); pad=text pads with visible body text (what
// it cannot strip, so it exercises the ldjson fallback and the raw large body).
function fixture(mb: number, pad: string): string {
  const ld = JSON.stringify({
    "@context": "https://schema.org", "@type": "Recipe", name: "Chicken tikka masala", recipeYield: "4",
    recipeIngredient: ["500g chicken thighs", "150g natural yoghurt", "1 tbsp garam masala", "400g tin chopped tomatoes"],
    recipeInstructions: [{ "@type": "HowToStep", text: "Marinate the chicken." }, { "@type": "HowToStep", text: "Simmer in the sauce." }],
  });
  const target = Math.round(mb * 1024 * 1024);
  const unit = pad === "text"
    ? "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.</p>\n"
    : `<script>window.__a=${JSON.stringify("x".repeat(400))};</script><style>.c{color:red}</style><svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>\n`;
  const padding = unit.repeat(Math.max(0, Math.ceil(target / unit.length)));
  return `<!doctype html><html><head><title>Fixture ${mb} MB (${pad})</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="canonical" href="https://example.org/recipes/chicken-tikka-masala">
<script type="application/ld+json">${ld}</script></head><body>
<h1>Chicken tikka masala</h1><p>Fixture page: about ${mb} MB padded with ${pad}. Share this page to the Shortcut.</p>
<ul class="ingredients"><li>500g chicken thighs</li><li>150g natural yoghurt</li></ul>
${padding}</body></html>`;
}

function dashboard(): string {
  const links = (Object.keys(MODES) as Mode[])
    .map((k) => (k === mode ? `<b>${k}</b>` : `<a href="/mode?set=${k}">${k}</a>`)).join(" &middot; ");
  const fixtures = [0.3, 1, 2, 4, 7].flatMap((mb) => ["junk", "text"].map((p) => `<a href="/fixture?mb=${mb}&pad=${p}">${mb} MB ${p}</a>`)).join(" &middot; ");
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="5">
<title>Shortcut stub</title><body style="font:14px system-ui;margin:16px">
<h1>Shortcut stub (PROTOTYPE)</h1><p>Response mode: ${links}</p><p>Fixtures: ${fixtures}</p>
<p><a href="/capture.js">capture.js</a></p>
<pre style="white-space:pre-wrap">${log.map((e) => JSON.stringify(e)).join("\n").replace(/</g, "&lt;")}</pre>`;
}

createServer(async (req, res) => {
  const u = new URL(req.url ?? "/", "http://stub");
  try {
    if (req.method === "POST" && u.pathname === "/api/v1/import") return await handleImport(req, res);
    if (u.pathname === "/mode") {
      const next = u.searchParams.get("set");
      if (next && next in MODES) mode = next as Mode;
      res.writeHead(303, { location: "/" }); return res.end();
    }
    if (u.pathname === "/fixture") return send(res, 200, fixture(Number(u.searchParams.get("mb") ?? 1), u.searchParams.get("pad") ?? "junk"), "text/html");
    if (u.pathname === "/capture.js") return send(res, 200, readFileSync(new URL("./capture.js", import.meta.url), "utf8"), "text/plain");
    if (u.pathname === "/log.json") return send(res, 200, JSON.stringify(log, null, 2));
    return send(res, 200, dashboard(), "text/html");
  } catch (e) {
    return send(res, 500, JSON.stringify({ error: "stub", message: String(e) }));
  }
}).listen(PORT, () => console.log(`stub on http://localhost:${PORT}`));
