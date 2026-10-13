# Import capture contract

Resolves [Specify the import capture contract](https://github.com/Ed-Barnes937/FindersEaters/issues/24). Feeds the V0.1 spec (`docs/spec/v0.1.md`) and the design brief (`docs/spec/design-brief.md` section 6.4). Builds on the original text contract in section 2 of `docs/spec/engine-pipeline.md`, the import token rules in section 7 of `docs/spec/auth.md`, and the recipe row in section 4 of `docs/spec/data-model.md`.

Every decision here was made by the agent under the owner's standing rules and is reversible. The extractor is a pure function with fixture tests, the HTTP body is versioned (`/api/v1/import`, additive changes only), and the one durable addition (the stored capture, section 7) is the conservative direction: keeping evidence can be undone, not keeping it cannot.

## 1. Shape in one paragraph

Devices capture, the server extracts. Every capture route hands the one **import service** a **capture**: either a link (a URL, optionally with the page HTML the device already has) or a typed-in recipe. The service turns a link capture into page HTML (the device's, or a server fetch when there is none or it yields nothing), runs one pure **extractor** over it (JSON-LD first, merged with the page's HTML ingredient block for headings and lost punctuation), and gets back the original text, the provenance and a capture report. It checks for a duplicate, saves the recipe and its capture, runs the engine inline, and answers. Nothing on a device parses recipes, so the iPhone Shortcut, which cannot be updated remotely, stays a dumb pipe and every extraction fix ships with the server.

## 2. Capture routes

| Route | Transport | What the device sends | HTML source |
|---|---|---|---|
| **Paste a link** (any device) | tRPC `recipe.import`, session | `{ kind: "link", url, via: "paste" }` | Server fetch |
| **Android share target** | Manifest `share_target` to `/share` (GET, params `title`, `text`, `url`), then tRPC `recipe.import`, session | `{ kind: "link", url, via: "android_share" }` | Server fetch |
| **iPhone Shortcut**, from Safari | `POST /api/v1/import`, import token | `{ url, html, client }` | Device (the rendered page) |
| **iPhone Shortcut**, from another app (a link, not a Safari page) | `POST /api/v1/import`, import token | `{ url, client }` | Server fetch |
| **Type it in** (any device) | tRPC `recipe.import`, session | `{ kind: "manual", ... }` (section 6) | None |

- **Android `/share`** is an SPA route. Chrome often puts the page URL in `text` rather than `url`, so the page takes the first `http(s)` URL found in `url`, then `text`, then `title`. No URL: "That share didn't include a link" with a Type it in button. Signed out: sign in, then resume with the same parameters. Offline: "You're offline" and the link is kept in the Paste a link sheet; imports are not queued.
- **The Shortcut** (one shared iCloud link, token from its import question, per `docs/spec/auth.md` section 7):
  1. Receives URLs and Safari web pages from the share sheet.
  2. If the input is a Safari web page: Run JavaScript on Webpage runs the **capture script** in `docs/spec/ios-shortcut.md` and returns `{ url: location.href, html }`, where `html` is the page trimmed on the device (not raw `outerHTML`). Otherwise it uses the input URL and no HTML.
  3. Get Contents of URL: `POST /api/v1/import`, `Authorization: Bearer <token>`, JSON body `{ url, html?, client: "ios-shortcut/1" }`.
  4. Shows the response's `message` as a notification, whatever the status.
  The build sheet, setup how-to and degradation rules are in `docs/spec/ios-shortcut.md`. The how-to adds one step to the three in the auth spec: turn on Settings > Apps > Shortcuts > Advanced > Allow Running Scripts.
- **The Shortcut's notification has no tap target.** A Shortcuts notification cannot open the installed web app (iOS gives link capture only to native apps, and a Safari tab has separate storage), so it confirms and tells the user where to look: `Saved "Chicken tikka masala". 4 lines to check in Finders Eaters.` The recipe tops the library under Recently added with its needs-review marker. This replaces "Saved - tap to review" in the design brief.
- **Desktop** has Paste a link and Type it in. The bookmarklet (device capture on desktop) is later and will use the HTTP route with a token.

## 3. The HTTP route body (`POST /api/v1/import`)

Auth, `401` and `429` are the auth spec's. This section owns the bodies.

**Request** (`application/json`, route body limit 6 MB; a page's `outerHTML` is typically 0.3 to 2 MB):

| Field | Type | Notes |
|---|---|---|
| `url` | string, required | `http` or `https`, at most 2048 characters. |
| `html` | string, optional | The rendered page. Treated as untrusted input: parsed, never rendered or executed. An empty string counts as absent. |
| `client` | string, optional | `<name>/<version>`, e.g. `ios-shortcut/1`. |

**Responses.** Every body has `status` or `error` plus a `message` written for the person (the Shortcut shows it verbatim).

| Status | Body | When |
|---|---|---|
| `201` | `{ status: "imported", recipeId, title, needsReview, run: "complete" \| "partial", message }` | Saved. `message` is `Saved "<title>".` plus ` N lines to check in Finders Eaters.` when it needs review, or ` Still being read.` when the run is partial. |
| `200` | `{ status: "duplicate", recipeId, title, message }` | The household already has a live recipe with this canonical URL (section 5). `Already in your library: "<title>".` |
| `400` | `{ error: "bad_request", message }` | Missing or invalid `url`. |
| `413` | `{ error: "too_large", message }` | Body over 6 MB. |
| `422` | `{ error: "unreadable", reason, message }` | No recipe could be extracted (reasons in section 4.4). Nothing is saved. |
| `426` | `{ error: "update_shortcut", message }` | `client` is below the server's minimum for that client name. `This Shortcut is out of date. Get the new one in Finders Eaters: Settings, Import from iPhone.` |

The tRPC procedure takes the capture union (sections 2 and 6, plus `force: true` to import past a duplicate) and returns the same result shapes as data, so both transports share the import service and its result type.

## 4. Link captures: from HTML to original text

### 4.1 Getting HTML

1. **Device HTML** when the capture has it.
2. **Server fetch** when it does not, or when the device HTML yields no recipe (an AMP or reader-mode page):
   - One attempt with browser-like headers (a current desktop Chrome user agent, `Accept: text/html`, `Accept-Language: en-GB`). No headless browser and no retry in V0.1.
   - At most 5 redirects, 8 s overall, 5 MB of body, `text/html` or `application/xhtml+xml` only.
   - **SSRF guard**: `http`/`https` on ports 80 and 443 only; every hop's hostname is resolved and rejected if any address is loopback, private, link-local, unique-local (which covers Fly's `fdaa::/16` private network) or a metadata address. Tests allow a fixture host through configuration, never through the request.
3. If neither yields a recipe, the capture is unreadable (section 4.4).

The fetch budget sits beside the engine's own 8 s budget, so an import request takes at most about 16 s plus the save.

### 4.2 The extractor

A pure function in its own package: `extract(html, pageUrl) -> { source, provenance, report } | { unreadable: reason }`. No I/O, versioned (`extractorVersion`), tested against saved pages.

**Finding the recipe**

- JSON-LD: every `<script type="application/ld+json">`, tolerating `@graph`, top-level arrays, `@type` arrays (`["Recipe", "NewsArticle"]`) and a Recipe under `mainEntity`. Malformed JSON in one block skips that block only.
- Microdata (`itemtype` schema.org/Recipe) is read the same way when there is no JSON-LD Recipe.
- Candidates are Recipe nodes with at least one ingredient. One: use it. Several: the one whose `url` or `@id` matches the page URL, else the first, with report warning `multiple_recipes`. None, but the page has an ItemList of recipes: unreadable `recipe_list`.

**Mapping to the original text** (field names from `docs/spec/engine-pipeline.md` section 2). All strings are taken as text: HTML tags stripped, entities decoded, whitespace collapsed, trimmed. Nothing else is normalised, because normalising is the engine's stage 1 and the original text must stay what the page said.

| Field | From |
|---|---|
| `title` | `name`. |
| `ingredientLines` | `recipeIngredient` (or legacy `ingredients`), empty strings dropped, then merged with the HTML ingredient block (4.3). Each line is `{ text, heading? }`. |
| `method` | `recipeInstructions`: a string is split on line breaks; `HowToStep` gives its `text` (else `name`); `HowToSection` gives its `name` as a line with `heading: true`, then its steps. Each line is `{ text, heading? }`, the same shape as ingredient lines (an additive refinement of the engine spec's "list of step strings"). |
| `yield` | `recipeYield`: a string as is; a number as its digits; an array gives the first element containing a letter ("4 servings" over "4"), else the first. |
| `times` | `prepTime`, `cookTime`, `totalTime` as raw strings, each only when present. The engine parses them and tolerates malformed durations. |
| `sourceDomain` | The registrable domain (public suffix list) of the provenance URL, without `www`: `bbcgoodfood.com`, `bbc.co.uk`, `taste.com.au`. |

**Provenance** (the recipe row's provenance columns, `provenance_kind: "url"`):

| Column | From |
|---|---|
| `url` | The page's `<link rel="canonical">` when it is on the same registrable domain, else the page URL (the final URL after redirects for a server fetch). Fragment removed; `utm_*`, `fbclid`, `gclid`, `mc_cid`, `mc_eid` removed. This is the duplicate key. |
| `site_name` | `og:site_name`, else the Recipe's `publisher.name`, else `sourceDomain`. |
| `image_url` | The Recipe's `image` (a string, an `ImageObject`'s `url`, or the first of an array), else `og:image`; made absolute; kept only if `https`. |

**Limits**: more than 200 ingredient lines, more than 200 method lines, or any line over 2000 characters makes the capture unreadable (`too_large`), since that is a page the extractor misread, not a recipe.

### 4.3 The HTML ingredient block: headings and lost separators

schema.org `recipeIngredient` is a flat list. Some sites (BBC Good Food in the golden set) drop section headers ("For the sauce") and the comma between ingredient and prep ("4 eggs beaten") from their JSON-LD; the page HTML has both. So the extractor also reads the HTML ingredient block and merges it.

- **Finding the block.** First, known recipe-plugin markup, recognised by structure, not by domain: WP Recipe Maker (`wprm-recipe-ingredient-group`, `wprm-recipe-group-name`), Tasty Recipes, Mediavine Create, and microdata `itemprop="recipeIngredient"`. Otherwise the generic finder: the smallest element whose list items (`li`) contain, in order, at least 80% of the JSON-LD lines by match key (below). Site-specific adapters are added only where a fixture shows the generic finder failing.
- **Items and headings inside the block.** Each `li` is an item; its text is the visible text with a space at element boundaries, whitespace collapsed, and no space left before `,` `.` `)`. A heading is a non-`li` element between lists inside the block whose text is short (at most 80 characters) and contains no digit: `h2` to `h6`, `strong`/`b`, `p`, or a plugin's group-name element.
- **Match key**: lowercase, Unicode NFKC, keep only letters and digits. "4 eggs beaten" and "4 eggs, beaten" share a key.
- **Merge rule.** If every JSON-LD line matches an HTML item, in order, by match key (extra HTML items are allowed and ignored), the original text is the **HTML item texts for those lines, in order, with the headings inserted where they sit** (`heading: true`). The HTML text wins because it keeps the punctuation the JSON-LD lost. If even one line fails to match, the JSON-LD lines are used alone, with no headings, and the report records `html_block_unaligned`. The merge is all-or-nothing so a half-aligned block never mixes two sources' texts or misplaces a header.
- **No JSON-LD, block found** (microdata or a plugin block without JSON-LD): the block's items and headings are the ingredient lines, the title comes from `og:title` or the first `h1`, and method, yield and times are whatever microdata gives (often none). The report records `html_only`.
- **When headings are lost anyway** (no block, or unaligned), nothing is guessed at capture. The engine's segment stage still treats "For the ..." and trailing-colon lines as headers, the `duplicate_ingredient` check is per section, and review lets the household pin a role. Lost commas are the engine's segmentation problem, which the golden set already covers.

### 4.4 Unreadable captures

Nothing is saved for an unreadable capture: there is no original text to keep. Reasons and messages:

| `reason` | When | Message (Shortcut and in-app) |
|---|---|---|
| `blocked` | The server fetch got `401`, `403`, `429` or `503`, or a challenge page (no recipe and a known bot-wall marker). | `This site won't let Finders Eaters read it. On iPhone, share it from Safari with the Shortcut; or type it in.` |
| `fetch_failed` | DNS, connection, timeout, redirect limit, SSRF guard, or a non-HTML response. | `Couldn't open that page. Check the link, or type the recipe in.` |
| `no_recipe` | HTML with no Recipe JSON-LD, microdata or plugin block. | `Couldn't find a recipe on that page. You can type it in.` |
| `recipe_list` | A page listing several recipes. | `That page lists several recipes. Open the one you want and share that.` |
| `too_large` | Section 4.2 limits. | `That page didn't look like one recipe. You can type it in.` |

**In app**, an unreadable result shows the design brief's "Couldn't read that page" with the message and a **Type it in** button that opens the manual form with the link already filled in as provenance (section 6). The user copies the ingredients and method from their browser into the two text fields. There is no list of failed imports in V0.1: in-app failures are handled on the spot, and from the Shortcut device capture makes failure rare (a Safari page that has a recipe is already rendered and unblocked).

**Known gap**: Android and Paste a link have no device capture, so sites that block server fetches (Serious Eats, Allrecipes, taste.com.au, Delicious, Tesco, Mob for non-browser clients) always fall to Type it in on those routes. The fix is device capture (the bookmarklet, then the Capacitor share extension), not a headless browser.

## 5. Duplicates

- Before saving, the service looks for a live (not deleted) recipe in the household with the same provenance `url` (index on `household_id, url`, not unique).
- Found: no new recipe. The HTTP route answers `200 duplicate`. In app: "Already in your library" with **Open it** and **Import again**, which repeats the call with `force: true` and saves a second copy (for a household that wants a variant).
- Deleted recipes do not count: importing a deleted recipe's URL makes a fresh recipe. Restoring is the library's undo, not import's job.
- Manual entries are never duplicates.

## 6. Type it in: the manual capture

The form in design brief section 6.4, as a capture:

```
{ kind: "manual",
  title,                                  // required
  provenance: { kind: "book", title, page? } | { kind: "own" } | { kind: "url", url },
  yield: { kind: "serves" | "makes", n } | null,
  totalMinutes: number | null,
  ingredientsText,                        // required, at least one non-blank line
  methodText }                            // optional
```

| Original text field | From |
|---|---|
| `title` | `title`, trimmed. |
| `ingredientLines` | `ingredientsText` split on line breaks, each trimmed, blank lines dropped. No `heading` markers: the engine's segment stage recognises "For the sauce:" lines. |
| `method` | `methodText` split on blank lines, each paragraph trimmed. |
| `yield` | `"Serves N"` or `"Makes N"`, else null. |
| `times` | `totalTime` as `PT<n>M` when given (the engine then reads it like JSON-LD). |
| `sourceDomain` | From the URL when provenance is `url` (the fallback from an unreadable link), so the unit system rule still applies; else null. |

The `url` provenance case fills `site_name` from `sourceDomain` and leaves `image_url` null. It takes part in duplicate detection only through the link route, never here.

## 7. The stored capture

Each imported recipe keeps what it was extracted from, in a `recipe_capture` row (one per recipe, durable, deleted with the recipe's household):

| Column | Notes |
|---|---|
| recipe_id (PK, FK) | |
| route | `paste`, `android_share`, `ios_shortcut`, `manual`. |
| client | The HTTP `client` value, or null. |
| requested_url, final_url | As sent, and after redirects (null for device HTML and manual). |
| html_origin | `device`, `server`, or null for manual. |
| http_status | Of the server fetch, or null. |
| html | The page HTML, **trimmed** (scripts other than JSON-LD, styles, SVG, iframes and comments removed; attributes other than `class`, `id`, `itemprop`, `itemtype`, `rel`, `href`, `property`, `name`, `content` dropped), gzip-compressed. Tens of KB per recipe. Null for manual. |
| extractor_version | |
| report | JSON: which path ran (`jsonld+html`, `jsonld`, `html_only`, `manual`), warnings (`multiple_recipes`, `html_block_unaligned`), and line counts. |

Why keep it: when the extractor is wrong (an unaligned block, a missed heading), the evidence that explains it is the page as it was on the day, which may since have changed or vanished. Saved captures become extractor fixtures, as reviewed lines become golden-set candidates. **The stored capture never rewrites the original text**: corrections are anchored to it. Re-extracting into a recipe would be an explicit future "re-import" that orphans corrections the normal way, and is not in V0.1.

## 8. Tests

- **Extractor fixtures**: saved pages from BBC Good Food (including the golden set's jalfrezi and leek soup, which must come out with their section headers and their commas), RecipeTin Eats (WP Recipe Maker), Jamie Oliver, NYT Cooking, and a device-captured Serious Eats page; each with its expected original text, provenance and report. Plus synthetic cases: `@graph`, `@type` arrays, `HowToSection`, array `recipeYield`, two recipes on a page, a recipe list, an unaligned block, microdata only, malformed JSON-LD next to a good block.
- **Import service**: duplicate and `force`; unreadable saves nothing; device HTML that yields nothing falls back to a server fetch; the SSRF guard rejects private, loopback, link-local, `fdaa::` and metadata addresses, including after a redirect.
- **HTTP route**: each response status and body; the 6 MB limit; `426` for an old `client`.
- **E2E (Playwright)**: Paste a link against a local fixture page; Android `/share` with the URL in `text`; the HTTP route with a token and a device-HTML body; an unreadable link leading to Type it in with the link filled in.

## Hand-offs

- **Data model** (`docs/spec/data-model.md`): the `recipe_capture` table (section 7); a non-unique index on recipe `(household_id, url)`; method lines in the original text are `{ text, heading? }` like ingredient lines.
- **Engine pipeline** (`docs/spec/engine-pipeline.md` section 2): method becomes an ordered list of `{ text, heading? }`; manual total time arrives as `PT<n>M`.
- **Design brief** (`docs/spec/design-brief.md` section 6.4): the Shortcut notification has no tap target and reads `Saved "<title>". N lines to check in Finders Eaters.`; the "Couldn't read that page" state shows the reason's message and Type it in opens with the link filled in; the duplicate state ("Already in your library", Open it, Import again); the Android "no link in that share" and offline states; the Shortcut setup how-to gains the Allow Running Scripts step.
- **Auth** (`docs/spec/auth.md` section 7): unchanged; the route's body limit is 6 MB.
- **V0.1 spec**: the capture routes table (section 2), the HTTP bodies (section 3) and the known gap (section 4.4).
