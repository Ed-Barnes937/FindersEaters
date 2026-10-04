# iOS import and platform path

Research spike, 2026-09-25. Question: how few taps can "import this recipe from a web page on my phone" take, first as a PWA (V0.1) and later wrapped in Capacitor?

Legend: **[V]** verified from a primary source or a direct test on 2026-09-25. **[I]** inference or community report, not confirmed by a primary source.

## Summary

- A PWA cannot appear in the iOS share sheet. WebKit has never implemented the Web Share Target API, the bug has been open and unassigned since 2019, and neither Safari 26.x nor Safari 27.0 (released 2026-09-17) mentions it. [V]
- On Android, an installed PWA in Chrome can be a share target today via the manifest `share_target` member. [V]
- An Apple Shortcut can appear in the iOS share sheet, receive the page URL, and POST it to our API. It is distributed as an iCloud link, is free, and needs no developer licence. [V]
- Opening the installed PWA with the URL as a parameter from a Shortcut is not reliable, because iOS opens https links in Safari, never in a Home Screen web app, and the two have separate storage. [I, consistent community reports]
- A Capacitor share extension needs the App Groups capability, which a free Apple Account cannot use. In practice the Capacitor share-sheet stage starts when the $99/yr licence is bought. [V]
- Several big UK recipe sites block plain server-side fetches (Delicious, Tesco, Waitrose, and Mob for non-browser user agents). Where pages load, Recipe JSON-LD is present and well formed. [V, spot check]

## Recommendation

**V0.1 (PWA, no Apple licence).**
1. Primary iOS path: an "Add to Recipebook" Shortcut, shared via iCloud link, shown in the share sheet for URLs and Safari web pages. It POSTs `{url}` (and ideally the page's JSON-LD or HTML, see point 3) to `/api/import`, authenticated by a per-household import token collected through an import question when the Shortcut is added. It then shows a notification ("Saved - tap to review"). That is about 3 taps from the recipe page: Share, then the shortcut, plus a one-time domain permission prompt.
2. Fallback: an in-app "Paste link" button that calls `navigator.clipboard.readText()` on tap. It also accepts a pasted URL in a text field. Import review lives in the PWA.
3. Because of bot protection, let the Shortcut capture the page client-side where it can: "Run JavaScript on Webpage" (Safari input only) to extract `<script type="application/ld+json">`, or send the page HTML. The server parses what it receives and only fetches the URL itself as a fallback. This also serves a bookmarklet and the future native share extension, so build the import API as "accept URL + optional captured HTML/JSON-LD" from day one.
4. Android: add `share_target` to the manifest. It is nearly free, and it gives the ideal flow on Android Chrome.

**Capacitor stage (after buying the licence).**
- Use `@capgo/capacitor-share-target` (MPL-2.0, Capacitor 8, published 2026-09-22) or `@mindlib-capacitor/send-intent` (MIT, Capacitor 8, last published 2026-01-22). Both need a hand-made Share Extension target in Xcode plus an App Group. Avoid the Capawesome share-target plugin unless you want a paid Insiders subscription.
- Keep the same `/api/import` contract, so the native extension simply replaces the Shortcut.
- For cookbook scanning, prefer a native document scanner (VisionKit on iOS, ML Kit on Android) via `@capgo/capacitor-document-scanner`, with `@capacitor/camera` v8 as the simple capture path that also works on the web.

## 1. Web Share Target API

- MDN browser-compat-data: `share_target` is supported in Chrome desktop 89+, Chrome Android 76+, Edge, Opera and Samsung Internet. It is **not supported** in Safari, Safari iOS, WebView iOS, Firefox, Firefox Android ("parses, but has no effect") or Android WebView. MDN marks it experimental and not Baseline (page modified 2026-08-27). [V]
- web.dev: available "on Android with WebAPK and ChromeOS", and only after the PWA is installed. On iOS/iPadOS, only App Store-published wrapped PWAs can handle URLs (page updated 2022-04-15, still accurate). [V]
- WebKit bug 194593, "Add support for Web Share Target API": status NEW, P2, unassigned, filed Feb 2019, still getting comments in 2026. WebKit's standards position was reported as "neutral" in the thread. [V]
- iOS 26 made every Home Screen site open as a web app by default, with no manifest required (heise, 2025-10-10; WebKit Safari 26 notes). That improves "install" but adds no share target. [V]
- Safari 27.0 feature list (webkit.org, 2026-09-17) and the WWDC26 WebKit session contain nothing on web apps, share target or link capture. [V]
- **Answer: there is no way for a PWA itself to appear in the iOS share sheet today.** The only share-sheet presence available without native code is a Shortcut. [V]

## 2. Apple Shortcuts as a bridge

- Share sheet: enabling "Show in Share Sheet" in a shortcut's details adds an input step. The accepted input types (URLs, Safari web pages, text) decide where it appears. [V, Apple Shortcuts guide]
- Networking: "Get Contents of URL" supports GET/POST/PUT/PATCH/DELETE, with headers and a JSON, form or file request body. So POSTing `{url, token}` to our API is supported. [V]
- Page capture: "Run JavaScript on Webpage" works on Safari web page input. It triggers a per-shortcut, per-webpage permission prompt ("about to interact with the webpage") that is remembered afterwards, and it requires the "Allow Running Scripts" setting. [V] A first network call to a new domain also shows an allow prompt, remembered afterwards (iOS 15+). [I, Apple Community reports]
- Opening the PWA: an "Open URLs" action with `https://our.app/import?url=...` will open in Safari, not the installed web app. iOS gives link capture (Universal Links) only to native apps. [I, consistent community reports, no Apple doc] Home Screen web app storage is isolated from Safari, and cookies are copied only at install time, so the Safari tab may not be logged in. [V, WebKit tracking-prevention docs] This is why the POST-then-notify design is preferred.
- Distribution: Shortcuts, then share, then "Copy iCloud Link" gives `https://www.icloud.com/shortcuts/<id>`. The recipient taps "Get Shortcut". Import questions can personalise it on install, for example by asking for the import token. Apple receives a copy for validation. [V]
- Friction points [I]: the user must have the Shortcuts app (preinstalled, but deletable); first-run permission prompts; the shortcut often sits in the lower "actions" list of the share sheet unless the user edits favourites; updates mean re-sharing a new link, with no auto-update; the token lives in plain text inside the shortcut; Shortcuts behaviour shifts between iOS releases.
- Verdict for a household-scale V0.1 [I]: very reasonable. It is free, it needs about 30 minutes of one-time setup per device, and it can be versioned via a "shortcut version" field in the POST, so the server can say "please update".

## 3. Other iOS fallbacks for a PWA

- Clipboard read: `navigator.clipboard.readText()` needs a secure context and, in Safari, a user gesture. Outside the same-origin exception, iOS shows a "Paste" callout the user must tap (WebKit blog, 2020-06-23; MDN Baseline 2024). Reading silently on focus or `visibilitychange` is therefore **not possible**. The best flow is a big "Paste link" button: tap, then tap the Paste callout, so 2 taps after copying the link. [V]
- Plain paste field: always works (long-press, Paste). Zero platform risk. [V by construction]
- Bookmarklet: a `javascript:` bookmark in Safari can read the page DOM, including JSON-LD, and send it to our API or open our app with the data. It bypasses bot protection because it runs in the user's browser. Installing one on iOS is awkward: bookmark any page, then edit its URL to paste the code. It is reached through the Bookmarks menu, not the share sheet, and cross-origin POSTs need CORS on our API. [I, well-known technique, not re-verified on iOS 26]
- Push notifications (iOS 16.4+) can open URLs inside the installed web app. That is not useful for import, but it is the one known in-app deep-link path. [I]

## 4. Capacitor

- Current Capacitor: `@capacitor/core` 8.5.2 (npm `latest`, 2026-09-11). 9.0.0 is at alpha.7. Capacitor 8 needs Xcode 26+ and iOS 15+, and uses SPM by default for new iOS projects. [V, npm registry and capacitorjs.com/docs/updating/8-0]
- Adding a share extension [V, plugin READMEs]: open `ios/App` in Xcode, File > New > Target > Share Extension, set `NSExtensionActivationRule` (for example `NSExtensionActivationSupportsWebURLWithMaxCount = 1`, plus text), enable **App Groups** on both targets (`group.<bundle id>`), and register a custom URL scheme. The extension stores the payload in the group container and opens the app via the scheme. The AppDelegate forwards the URL to the plugin, which emits a JS event. Android needs only intent filters in `AndroidManifest.xml`.
- Plugins (npm data as of 2026-09-25):

| Plugin | Licence | Capacitor | Last publish | Notes |
|---|---|---|---|---|
| `@capgo/capacitor-share-target` | MPL-2.0 | 8 (maintained), 7 on demand | 8.0.54, 2026-09-22 | iOS + Android, `shareReceived` event; a recent fix mentions Capacitor 9 compatibility |
| `@mindlib-capacitor/send-intent` (formerly `send-intent`, carsten-klaffke) | MIT | >=8 | 8.0.6, 2026-01-22 | Long-lived (v5 2023, v6 2024, v7 2025, v8 2026-01) |
| Capawesome Share Target | Proprietary, Insiders (paid) | 8 | - | iOS, Android, Web |

- Free provisioning blocks this: Apple's capability table lists **App Groups, Associated Domains, Push and iCloud as unavailable** to free Apple Accounts. So these plugins cannot be tested on-device before buying the licence. [V] A URL-only extension that POSTs directly to the API without an App Group may be possible, but it is untested and would still need shared auth. [I]
- Scanning: `@capacitor/camera` v8 (iOS, Android, Web) for photos. `@capgo/capacitor-document-scanner` (MPL-2.0, 8.4.6, 2026-09-22) wraps VisionKit and ML Kit, with edge detection and multi-page capture. `@capawesome-team/capacitor-document-scanner` does the same but is Insiders-only. `@capacitor-mlkit/document-scanner` is Android only. [V]

## 5. Developer programmes and costs

- Apple Developer Program: **$99 USD/year**, charged in local currency at enrollment. The widely reported UK price is **£79/year** [I, not shown on Apple's pages]. Individuals enrol under their legal name and organisations need a D-U-N-S number. The fee is waivable for nonprofits, education and government. [V]
- Free Apple Account: on-device testing from Xcode, with provisioning that **expires after 7 days**. It is limited to **10 App IDs, 3 devices, 3 apps per device**, with no TestFlight or App Store Connect and a restricted capability set (see section 4). [V]
- TestFlight: requires paid membership and App Store Connect. External testers need a Beta App Review of the first build. [V for membership; I for review detail]
- Google Play: **$25 one-time**. Personal accounts created after 2023-11-13 need **12 testers opted in for 14 continuous days** in a closed test before production. [V] Separately, Android developer verification now applies to sideloaded apps (enforced from 2026-09-30 in BR/ID/SG/TH, with more countries in 2027). A free "limited distribution" account covers up to 20 devices, which suits a household. [V, Android Developers Blog, March 2026]

## 6. UK recipe sites: JSON-LD and server-side fetch

Spot test on 2026-09-25 with curl from a UK residential IP, using a Chrome user agent and then a `curl/8` user agent:

| Site | Fetch | Recipe JSON-LD |
|---|---|---|
| BBC Good Food | 200 both UAs | Yes (11 ingredients, list instructions) |
| BBC Food (bbc.co.uk/food) | 200 both UAs | Yes |
| Jamie Oliver | 200 both UAs (Cloudflare JS beacon only) | Yes (25 ingredients) |
| Mob | 200 Chrome UA, **403 curl UA** (Cloudflare) | Yes |
| Delicious | **403** Cloudflare "Attention Required", even with a Chrome UA; WebFetch loaded the index once but 403'd the recipe | Not checked |
| Tesco Real Food | realfood.tesco.com now 301s to tesco.com/recipes; **403 Akamai "Access Denied"** | Not checked |
| Waitrose | **Timed out** (curl and WebFetch) | Not checked |

- Where pages load, Recipe JSON-LD is present and complete. That is expected, because these sites rely on Google recipe rich results, which need it. [V for the four; I for the rest]
- Blocking is common and is based on TLS or client fingerprinting, not just the user agent. Datacentre IPs are likely to fare worse than this residential test. [I] So capturing the page client-side (Shortcut JS, bookmarklet, native extension) should be the primary path for these sites, with server fetch as the fallback, and "paste the recipe text" as the last resort.

## Sources (accessed 2026-09-25)

- MDN share_target (mod. 2026-08-27): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target
- MDN BCD data: https://github.com/mdn/browser-compat-data/blob/main/manifests/webapp/share_target.json
- web.dev OS integration (2022-04-15): https://web.dev/learn/pwa/os-integration/
- WebKit bug 194593: https://bugs.webkit.org/show_bug.cgi?id=194593
- WebKit Safari 27.0 features (2026-09-17): https://webkit.org/blog/18325/webkit-features-for-safari-27-0/
- WebKit Safari 26.0 features: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- heise, iOS 26 web app behaviour (2025-10-10): https://www.heise.de/en/news/iOS-26-and-iPadOS-26-Changed-web-app-behaviour-on-the-home-screen-10749652.html
- WebKit tracking prevention (web app storage isolation): https://webkit.org/tracking-prevention/
- WebKit async clipboard (2020-06-23): https://webkit.org/blog/10855/async-clipboard-api/
- MDN Clipboard.readText: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText
- Apple Shortcuts, run from another app / share sheet: https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios
- Apple Shortcuts, share shortcuts (iCloud link, import questions): https://support.apple.com/guide/shortcuts/share-shortcuts-apdf01f8c054/ios
- Apple Shortcuts, Get Contents of URL: https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios
- Apple Shortcuts, advanced privacy settings: https://support.apple.com/guide/shortcuts/advanced-shortcuts-settings-apdfeb05586f/ios
- PWA deep-link limits on iOS (community): https://intercom.help/progressier/en/articles/6902113-complete-guide-to-pwa-deep-links
- Capacitor 8 update guide: https://capacitorjs.com/docs/updating/8-0
- Capacitor Camera v8: https://capacitorjs.com/docs/apis/camera
- Capgo share target: https://github.com/Cap-go/capacitor-share-target
- send-intent: https://github.com/carsten-klaffke/send-intent
- Capawesome share target: https://capawesome.io/docs/plugins/share-target/
- Capgo document scanner: https://github.com/Cap-go/capacitor-document-scanner
- Capawesome ML Kit document scanner: https://capawesome.io/docs/sdks/capacitor/mlkit/document-scanner/
- npm registry (versions and dates): https://registry.npmjs.org/
- Apple membership comparison: https://developer.apple.com/support/compare-memberships/
- Apple supported capabilities (iOS): https://developer.apple.com/help/account/reference/supported-capabilities-ios
- Apple program enrollment: https://developer.apple.com/help/account/membership/program-enrollment/
- Apple membership details ($99): https://developer.apple.com/programs/whats-included/
- Google Play registration fee: https://support.google.com/googleplay/android-developer/answer/6112435
- Google Play testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
- Android developer verification (March 2026): https://android-developers.googleblog.com/2026/03/android-developer-verification-rolling-out-to-all-developers.html
