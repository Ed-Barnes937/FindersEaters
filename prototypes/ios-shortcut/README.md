# iPhone Shortcut prototype (THROWAWAY)

Throwaway branch `prototype/ios-shortcut`. Never merge. It answers [Prototype the iPhone Shortcut against a stub import endpoint](https://github.com/Ed-Barnes937/FindersEaters/issues/27); the decided Shortcut lives in `docs/spec/ios-shortcut.md` on main.

- `stub.ts` - a no-dependency stub of `POST /api/v1/import` with switchable responses, recipe fixture pages and a live log.
- `capture.js` - the body of the Shortcut's Run JavaScript on Webpage action (generic trim, never recipe parsing).

## Run it

```sh
node prototypes/ios-shortcut/stub.ts                 # Node 24, http://localhost:8787
cloudflared tunnel --url http://localhost:8787       # free quick tunnel, gives an https URL the phone can reach
```

Open the tunnel URL on a laptop for the dashboard (response mode links, fixtures, log, auto-refresh every 5 s). Open `<tunnel>/fixture?mb=2&pad=junk` in Safari on the iPhone and share it to the Shortcut.

Fixtures: `mb` is the page size; `pad=junk` pads with scripts, styles and SVG (what the trim removes), `pad=text` pads with visible text (what it cannot remove, so it exercises the JSON-LD-only fallback and, with the raw variant, a genuinely large POST).

## Build the test Shortcut

Build it per `docs/spec/ios-shortcut.md` section 2, with the server URL set to `<tunnel>/api/v1/import` and any `fe_imp_test` key. For check 1 make a second copy, "FE raw", whose JavaScript is only:

```js
completion({ url: location.href, html: document.documentElement.outerHTML, probe: { fullChars: document.documentElement.outerHTML.length, trim: "raw" } });
```

## Device checks

Run on a current iPhone (record the iOS version). Each row has a pass rule; a fail points at the fallback named.

| # | Check | How | Pass | If it fails |
|---|---|---|---|---|
| 1 | Run JavaScript returns a large result | FE raw on `mb=2&pad=text`, then `mb=4&pad=text` | Log shows `htmlChars` near the full size, no Shortcuts memory error | Lower `CAP` until it passes; the trimmed Shortcut never sends more than `CAP` |
| 2 | Get Contents of URL POSTs a large body | Same runs; compare `bytes` with `probe.fullChars` | Bytes arrive intact, `parseError` null | Same as 1 |
| 3 | Large-data prompt | Note any "Allow ... to share large amounts of data" prompt and the smallest fixture that triggers it, with Settings > Apps > Shortcuts > Advanced > Allow Sharing Large Amounts of Data off, then on | Prompt threshold above `CAP`, or the toggle removes it | Add the toggle to the setup how-to, or lower `CAP` below the threshold |
| 4 | Trimmed capture | Real Shortcut on `mb=2&pad=junk`, `mb=2&pad=text`, and 3 real recipe sites | `probe.trim` is `strip` (junk) and `ldjson` (text); `htmlHasLdJson` true; real sites well under `CAP` | Adjust the selectors in `capture.js` |
| 5 | Message on every status | Cycle every response mode | The notification shows each `message` verbatim, including 400, 401, 413, 422, 426, 429 | If a non-2xx stops the Shortcut, turn on Get Contents of URL's response-status handling or have the HTTP route answer 200 with the error body (contract change) |
| 6 | Non-JSON and empty bodies | Modes `proxy_html_502` and `empty_204` | The fallback notification shows, no Shortcut error alert | Reorder the If so the fallback catches it |
| 7 | Timeout | Modes `slow_20s`, `slow_45s`, `slow_90s` | 20 s succeeds; note the largest that does | If 20 s fails, lower the HTTP route's engine budget so a request answers within the measured limit |
| 8 | Allow Running Scripts off | Turn it off, share a Safari page | Note the exact alert text and whether the Shortcut stops | Expected: iOS alert and stop; the how-to and troubleshooting line cover it |
| 9 | First-run prompts | Fresh install: note every prompt and its options (import question, first POST to the domain, first script on a site, a second site) | Each prompt is remembered after "Always Allow" | Record the counts in the setup how-to |
| 10 | Input from another app | Share a link from Notes or Messages | Log shows `url`, `htmlChars` 0 or null, fallback path taken | Fix the input-type branch |
| 11 | Share sheet placement | Find the Shortcut in Safari's share sheet | Listed; note whether it needs Edit Actions to be near the top | How-to step |

Paste the dashboard log (`/log.json`) and the notes into the device-check ticket.

## Desk results (2026-10-13, macOS Chrome headless, not a device)

- `capture.js` on fixtures: 2.1 MB junk page to 4.9 KB (`strip`, 10 ms); 0.3 MB text page kept whole; 2.1 MB text page to 518 chars (`ldjson`). JSON-LD and canonical kept in all three.
- Live pages (rendered DOM): BBC Good Food 854 KB to 317 KB, RecipeTin Eats 614 KB to 184 KB, Jamie Oliver 1.2 MB to 686 KB, each under 10 ms with JSON-LD kept. Allrecipes and Serious Eats served a 3 KB bot wall to headless Chrome, which is why device capture is the iPhone's primary path.
- Stub: 201 JSON, 502 HTML body and a 7 MB body (413 with JSON message) behave as intended under curl.
