# The iPhone Shortcut

The "Add to Finders Eaters" Shortcut is the iPhone's device capture route in `docs/spec/import-capture.md` section 2. This file is its build sheet. Token handling is `docs/spec/auth.md` section 7; the request and response bodies are `docs/spec/import-capture.md` section 3.

Decided in [Prototype the iPhone Shortcut against a stub import endpoint](https://github.com/Ed-Barnes937/FindersEaters/issues/27). The prototype (stub endpoint, fixtures, device check protocol) is on the throwaway branch `prototype/ios-shortcut`. Values marked **provisional** are set by the device check in section 7.

## 1. Principles

- **Still a dumb pipe.** The Shortcut never looks for a recipe. Its only logic is a generic size trim that removes markup the extractor never reads, so every extraction fix still ships with the server.
- **Bounded body.** The Shortcut never sends more than `CAP` characters of HTML (provisional: 1,000,000). The 6 MB route limit stays as the server's guard, not the Shortcut's normal path.
- **Every outcome ends in a readable notification**, including a server that answers with something that is not our JSON.
- **The Shortcut is versioned by `client`.** `ios-shortcut/1` is the first release and includes the trim. Any change to the actions or the script bumps the version; the server's `426` retires old ones.

## 2. Actions

1. **Receive** URLs and Safari web pages from the Share Sheet. If there is no input: Stop and Respond with "Share a recipe page or link to this Shortcut."
2. **Text**: the import key (an import question, "Paste your Finders Eaters import code"). Set variable `Key`.
3. **If** Type of Shortcut Input is Safari web page:
   - **Run JavaScript on Webpage** with the script in section 3. Set variable `Url` to its `url` and `Html` to its `html`.
   - **Otherwise**: Get URLs from Input, first item, as `Url`; `Html` is empty text.
4. **Get Contents of URL**: `POST https://<app host>/api/v1/import`, header `Authorization: Bearer <Key>`, Request Body JSON `{ url: Url, html: Html, client: "ios-shortcut/1" }`.
5. **Get Dictionary Value** `message` from the response.
6. **If** it has any value: **Show Notification** with it. **Otherwise**: Show Notification "Finders Eaters didn't answer. Try again in a minute, or use Paste a link in the app."

Expected iOS behaviour that the Shortcut cannot catch (Shortcuts has no try/catch): no connection, and Allow Running Scripts turned off, both end in an iOS alert and stop the Shortcut. The setup how-to and its troubleshooting line cover them.

## 3. The capture script

```js
var CAP = 1000000;
var root = document.documentElement.cloneNode(true);
root.querySelectorAll(
  'script:not([type="application/ld+json"]),style,svg,iframe,noscript,template,' +
  'link:not([rel="canonical"]),video,audio,canvas,object,embed'
).forEach(function (n) { n.remove(); });
root.querySelectorAll('[style]').forEach(function (n) { n.removeAttribute('style'); });
var w = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT), cs = [];
while (w.nextNode()) cs.push(w.currentNode);
cs.forEach(function (n) { n.remove(); });
var html = '<!doctype html>' + root.outerHTML;
if (html.length > CAP) {
  var ld = document.querySelectorAll('script[type="application/ld+json"]');
  if (ld.length === 0) {
    html = '';
  } else {
    var c = document.querySelector('link[rel="canonical"]'), keep = c ? c.outerHTML : '';
    ld.forEach(function (s) { keep += s.outerHTML; });
    html = '<!doctype html><html><head>' + keep + '</head><body></body></html>';
  }
}
completion({ url: location.href, html: html });
```

- **Stage 1, strip** (always): removes scripts other than JSON-LD, styles, SVG, embeds, comments, non-canonical links and inline styles. Microdata, the ingredient block, headings and `<meta>` tags stay, so the extractor's inputs (`docs/spec/import-capture.md` section 4.2 and 4.3) are untouched. On the desk check it cut real pages by 45 to 70% (BBC Good Food 854 KB to 317 KB) in under 10 ms.
- **Stage 2, JSON-LD only** (over `CAP`): the canonical link plus the JSON-LD blocks. The HTML ingredient block, and with it heading recovery, is lost for that page.
- **Stage 3, no HTML** (over `CAP` with no JSON-LD): the server fetches the URL, exactly as for a link from another app.

## 4. What this changes on the server

- **An empty `html` is no device HTML.** The route treats `html: ""` the same as an absent field (one Get Contents of URL action cannot omit a field on one branch).
- **Every response, including `401`, `413`, `429` and framework errors, carries a JSON `message`.** Error handlers on the HTTP route must not fall back to the framework's default body.
- **Answer within the Shortcut's timeout.** The route's worst case is about 16 s plus the save plus a Fly cold start. If the device check finds Get Contents of URL gives up sooner, the HTTP route lowers its engine budget and returns `run: "partial"` ("Still being read.").
- The stored `recipe_capture` keeps whatever HTML arrived; the `client` version tells a reader the trim was applied.

## 5. Setup how-to (Settings, Import from iPhone)

1. Copy the import code.
2. Tap Get the Shortcut, then Add Shortcut, and paste the code when it asks.
3. Turn on Settings > Apps > Shortcuts > Advanced > **Allow Running Scripts**.
4. (Only if the device check shows it is needed) Turn on **Allow Sharing Large Amounts of Data** in the same place.
5. In Safari, share a recipe page and pick Add to Finders Eaters. The first time, allow it to connect to Finders Eaters; the first time on each recipe site, allow it to run on that site (Always Allow).

Troubleshooting line: "If sharing says scripts aren't allowed, turn on Allow Running Scripts (step 3)."

## 6. Distribution

One iCloud link for everyone, held in server config so a new version only changes config. A new version means re-sharing the link and the `426` message pointing at it.

## 7. What the device check settles

Not verified on a device yet (the desk check ran in headless Chrome on macOS): that Run JavaScript on Webpage and Get Contents of URL carry a body of `CAP` characters from the share sheet without a memory error; whether a large-data prompt fires and at what size; that a non-2xx JSON body still reaches step 5; what a non-JSON or empty body does at step 5; the Get Contents of URL timeout; the exact first-run prompts. The protocol is in the prototype branch's `prototypes/ios-shortcut/README.md`. Its outcomes set `CAP`, step 4 of the how-to and, if needed, the HTTP route's engine budget. None of them change the contract's shape.
