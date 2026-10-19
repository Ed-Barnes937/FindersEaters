# Design brief: Finders Eaters V0.1

Written for a designer with no project context. Everything you need is on this page, the screenshots in [`screenshots/`](screenshots/INDEX.md) and the three prototype files in `docs/prototypes/`. This brief supersedes `docs/spec/design-brief.md` (2026-10-13): it carries every decision made since. Where it and a spec in `docs/spec/` disagree, the spec wins and this brief should be corrected.

**What exists today:** three throwaway behavioural prototypes (review, plan, shopping) whose behaviour is decided and whose look is not, and greyscale wireframes for every other V0.1 screen, drawn straight from the spec. Nothing is built yet. Your designs decide the look of the first build.

---

## 1. The product in one paragraph

Finders Eaters (a working name) is a recipe book that understands its recipes. A household brings in the recipes it already cooks, from recipe websites or typed in from a cookbook or its own notes, and the app reads each one into a consistent structured form: every ingredient line becomes an amount, a unit, a known ingredient and its prep, and every recipe is tagged (meal, cuisine, main protein, carb, method, effort, equipment, diet). That makes the collection properly searchable, and it lets the app help with the weekly chore of deciding what to cook. It suggests recipes that fit around the ones already chosen, **says why it suggests each one**, and turns the plan into a shopping list, merged across recipes and sorted by aisle, that already knows you have oil.

V0.1 is the core loop for one household: **import, check, find, plan, shop.**

## 2. Who it is for

- **One UK household first**: two adults who cook most evenings from a library of about 50 to 150 recipes, mostly from BBC Good Food, RecipeTin Eats, Jamie Oliver and a few cookbooks. Both share one library, one plan and one list. Accounts are made by an admin; there is no public sign-up.
- **The context of use matters more than the persona.** Three moments:
  1. **On the sofa, planning** (Sunday evening, unhurried, two people looking at one phone): browse, pick a few, let the app fill the rest.
  2. **In the shop** (one hand on a trolley, poor signal, interrupted, sometimes two people splitting up): tick things off fast, never lose the list.
  3. **Just after finding a recipe online** (on a phone, mid-scroll): import it in a couple of taps, answer anything the app was unsure of, move on.
- They are not food-tech enthusiasts. They want fewer decisions, not more features.

## 3. Platform and hard constraints

- **Mobile first.** Design at 390 x 844. Nothing may need hover. Tablet and desktop come later (one wide sketch of Recipes and Plan is welcome, not required).
- **An installable web app (PWA)**, not a native app: full screen from the home screen on Android and iPhone. Respect safe areas. No native-only patterns (no iOS swipe-to-delete, no Material FAB conventions).
- **Bottom navigation with three destinations**: Recipes, Plan, Shopping. Recipes is the start screen. Settings is reached from the Recipes header.
- **Thumb reach and one-handed use.** Primary actions sit low: sticky footers, bottom sheets, toasts above the nav. Top-of-screen controls are for navigation and rare actions. The shopping list must work one-handed with the other hand on a trolley.
- **Bottom sheets, not modals**, for secondary tasks (filters, why this, swap, edit a line, pick a day, new plan). On a phone the filter sheet is full height.
- **Touch targets** at least 44 px; shopping rows at least 60 px, whole row tappable.
- **Text first: no recipe images anywhere in V0.1** (list rows, recipe view, plan, shopping). Design dense, scannable text rows. Do not leave image slots.
- **Offline**: only the shopping list works offline (ticks queue on the phone and replay). Everything else shows an offline banner and stays readable but not editable.
- **No real-time sync.** A second phone's changes appear on load or refresh. No presence indicators or live cursors.
- **Accessibility**: WCAG 2.2 AA contrast in both themes; colour is never the only signal (the exclude chip has a minus sign and strike-through; a reason bar has its label and side); respect reduced motion (the shopping list's move-away animation becomes an instant move); every control reachable and labelled for screen readers.
- **Light and dark mode**, both first class. Dark is used in a dim kitchen; light in a bright supermarket.
- **Build target**: React with SCSS modules over Base UI (unstyled, accessible primitives). Components should map to ordinary primitives: dialog and bottom sheet, select, menu, toggle, tabs, toast, popover, autocomplete. Styling will be driven by design tokens, so the build can be restyled by changing tokens.

## 4. Principles and tone

- **Calm, plain and practical.** A well-organised friend in the kitchen, not a lifestyle brand and not a productivity app. No exclamation marks, no gamification, no streaks, no confetti, no emoji.
- **Honest about uncertainty.** The app is sometimes unsure and says so plainly ("How much ginger?", "Still being read"). It never pretends to know. Missing facts are left out, never shown as "Unknown".
- **It explains itself.** Every suggestion says why, in words a person would use ("Uses the rest of the fennel from Fennel and sausage pasta", "Not had in 7 weeks"). No scores, percentages or stars anywhere.
- **Never blocks.** A recipe is in the library the moment it is imported; checking it is optional and can wait.
- **Visual mood**: warm, readable and quiet; something you are happy to look at in a kitchen at 6 pm and in a bright supermarket. Legibility beats character; one restrained accent colour; plenty of contrast. The prototypes use a sage green accent, Atkinson Hyperlegible for UI text and Bricolage Grotesque for headings. That is a starting point, not a requirement; propose something better that keeps the legibility.

### What must always be visible

These are product principles, not styling choices. Do not hide them behind taps, tooltips or "more".

1. **A reason on every suggestion**, in words, with the full signed list one tap away. Never a score.
2. **Suggestions look different from the plan** until the household adds them.
3. **The original text during review and sample check.** Every line shows exactly what the recipe said, with the uncertain part highlighted, next to the app's reading. The original is never replaced by the parsed version.
4. **The dietary note** under every diet filter row and every set of diet tags: "A guide, not allergen safety. Check packaged ingredients like stock and soy sauce."
5. **Provenance** on every recipe row and recipe view ("BBC Good Food", "Weeknight Kitchen, page 112", "Our recipe").
6. **Where a shopping amount comes from**: the source line under every shopping row.
7. **That something needs checking**: the Review marker on rows and the "N things to check" banner, without nagging.
8. **Offline state** on the shopping list, with when the list was last loaded and how many ticks are waiting.
9. **Undo after every destructive or bulk action** (tick, remove from plan, bulk confirm, add all tags, add all suggestions), as a 4 s toast in the thumb zone.

Never shown: "Unknown" as a value, raw query syntax for ordinary filtering, scores or percentages, confidence numbers (the review prototype shows percentages on answers; that is a prototype artefact).

## 5. What changed since the first brief

If you have seen `docs/spec/design-brief.md`, these are the differences. Newcomers can skip to section 6; it already reflects them.

- **The engine now reads recipes with a hosted model with a daily request cap** (ADR 0002). Users never see a model name. The visible effect: when the service is down or the day's cap is reached, a recipe is saved and shown **"Still being read"** with its lines as written, and completes later. Treat this as a normal state, not an error ([24](screenshots/24-wf-import-still-being-read.png), [37](screenshots/37-proto-review-a-chosen-partial-run-still-being-read.png)).
- **Most ingredient lines now arrive without a question.** Line reading (amount, unit, prep) runs automatically at a 0.6 confidence gate, and line kind, ingredient and unit system at 0.8. In practice about half of ingredient lines arrive as **clear lines**, and the review screen is usually a quiet recipe with a few real questions. The review prototype (built when every line was flagged for a look) shows 12 glance lines; the now-typical screen is wireframe [42](screenshots/42-wf-review-current-modes-mostly-clear.png).
- **Glance lines vs check cards.** Two densities stay, with sharper roles:
  - **Check card** (expanded): a real question, such as a low-confidence amount ("How much ginger?"), an ambiguous ingredient ("Which butter?"), or whether to buy something ("Buy this, or is it optional garnish?"). Up to three one-tap answers plus Edit.
  - **Glance line** (compact, original over reading, round tick): the engine's reading is probably right but its mode still asks for a look. Today that is mostly **split questions** on lines containing "and", "or", "," or "/" ("salt and pepper, to taste": one line or two ingredients?), since that one stage stays review-first.
  - **Clear line** (muted original text, tap to expand and edit) is now the majority.
  - "Looks right - confirm N" covers glance lines only, so N is usually small.
- **Tags**: meal, cuisine, main protein, carb, method and equipment are applied automatically when confident, so "Tags we think fit" holds fewer chips. **Effort is always a suggestion**, so its small segmented choice (Easy / Medium / Hard, engine's pick outlined) appears on nearly every review.
- **A new screen: the sample-check view.** After the household's library is imported (in bulk, nobody reads every line), the app draws **150 automatically read lines at random** across the library. The owner checks them in a sample-check view: each line shows its recipe, its original text over the reading, and **Right** or **Correct it** (the same Edit sheet as review); progress "38 of 150"; about 15 minutes; resumable; the drawn lines never change. Corrections are saved to the recipes like any correction. The verdict (keep reading lines automatically, or go back to asking) is computed by an admin command, so the app shows counts, not a verdict. It may be used again (a second sample of 150) if the first is borderline. Wireframes [43](screenshots/43-wf-sample-check-intro.png) to [46](screenshots/46-wf-sample-check-done.png). Its entry point is open (section 9).
- **Plan, suggestions and shop decisions** were already in the first brief and are unchanged: inline suggestions with Add all, Another and Swap, Why this? as signed bars; plans never end on their own; New plan carries over recipes not cooked yet with their ticks; the shopping list moves ticked rows away, with At home and In the basket sections.

## 6. Screens, states and flows

Each screen lists its states. Links go to screenshots; `proto` images come from a prototype (copy the behaviour and content, redesign the look freely), `wf` images are rough wireframes (structure and content only; layout is yours).

### 6.1 Sign in

Working-name wordmark, email, password, one **Sign in** button. No sign-up link. "Forgotten your password?" says to ask the household's admin. On iPhone in Safari (not the installed app) a hint says to sign in inside the installed app, since they do not share a sign-in.

States: default [01](screenshots/01-wf-signin-default.png); Safari hint [02](screenshots/02-wf-signin-iphone-safari-hint.png); wrong password [03](screenshots/03-wf-signin-wrong-password.png); "Too many attempts, try again in a few minutes" [04](screenshots/04-wf-signin-too-many-attempts.png).

### 6.2 Recipes (library and search, one screen)

Empty query shows the whole library; typing or filtering narrows it. The planner reuses this screen as its recipe picker.

1. **Header**: "Recipes", a count ("124 recipes", or "12 of 124" while filtering), import (+), settings.
2. **Search box** "Search recipes". Bare words search titles.
3. **Typeahead** while a word is typed: "Title contains *chick*" (default), "Main protein: Chicken", "Ingredient: chicken", "Ingredient: chickpeas", "Tag: chicken nights". Picking one makes a chip.
4. **Active chips** in plain English ("Italian or Thai", "Not pork", "Under 30 min", "With fennel", "Without dairy", "Favourites", "Not cooked in 2 weeks"), each removable; tapping one opens the filter sheet at its row. "Clear" when two or more.
5. **Controls row**: Filters with an active count; sort (Recently added, A to Z, Quickest, Longest since cooked).
6. **Rows**: title (up to two lines, matched words bold), facts line (time, effort, cuisine; missing facts left out), provenance and last cooked, heart toggle, a small "Review" marker while it has things to check.

States: populated [05](screenshots/05-wf-recipes-library.png); typeahead [06](screenshots/06-wf-recipes-typeahead.png); filtered with chips [07](screenshots/07-wf-recipes-filtered-chips.png); no matches (chips stay, each repeated as a remove button, Clear all, no guessing) [08](screenshots/08-wf-recipes-no-matches.png); parse error in a typed query (span underlined, message, tappable "did you mean", no results) [09](screenshots/09-wf-recipes-query-error.png); first load skeletons (later loads dim previous results, never flash empty) [10](screenshots/10-wf-recipes-first-load.png); offline ("You're offline. Recipes need a connection.", loaded rows openable, filtering disabled) [11](screenshots/11-wf-recipes-offline.png); empty library ("No recipes yet" plus the import routes, no search box) [12](screenshots/12-wf-recipes-empty-library.png); pick mode from the planner ("Add to plan", Done, per-row add; tapping the row body still opens the recipe) [13](screenshots/13-wf-recipes-pick-mode.png).

### 6.3 Filter sheet

Full-height sheet: "Filters", "Clear all", sticky footer "Show N recipes" (live count; "No recipes" at zero). Rows in this order: Quick (Favourites, Not cooked in 2 weeks, Not cooked in 4 weeks), Meal, Time (15 min, 30 min, 45 min, 1 hour, Any), Main protein, Carb, Cuisine (two lines then "More"), Diet, Ingredients ("With" and "Without" autocomplete), Effort, Method, Equipment, Your tags.

- **Tri-state chips** cycle off, include, exclude. Include is filled; exclude is outlined with a minus and a struck-through label ("- Pork"). The one novel control in the app: design how a first-time user learns that a second tap excludes.
- A row shows only values the library has. No "Unknown" chip.
- **Diet note directly under the Diet label, always visible.**
- Ingredient autocomplete shows name plus parent ("Cream, dairy") and matches synonyms (coriander, cilantro).

States: top rows [14](screenshots/14-wf-filters-sheet-top.png); diet and ingredients [15](screenshots/15-wf-filters-sheet-diet-ingredients.png).

### 6.4 Recipe view and scaling

Top to bottom: back, title, heart, overflow (Review and correct, Delete); provenance in full (linking out for websites); a "3 things to check" banner when there are open questions; facts (total time, servings, effort, "Last cooked 12 Sept" or "Not cooked yet"); tags as labelled chip groups, each chip a link back into search, the diet note under diet chips, "Edit tags"; "Your tags" (free-form, removable, "+ Add tag"); ingredients with section headers; method as numbered steps; sticky **Add to plan**.

Scaling: a **servings stepper** ("4 servings", or "12 buns" for a makes-recipe, stepping in half or whole batches) with a **factor badge** ("x1.5") when not as written. At x1 lines show the original text; scaled, only the amount changes. **Scaling notes** under lines that do not scale cleanly ("Rounded from 1½", "Part tin - keep the rest", "Start with less and add to taste") and one recipe-level line, "Times and tin sizes are as written". A line written in cups, oz, lb or pints shows a muted **metric hint** ("1 cup flour (125 g)"). Opened from a plan item, the stepper is labelled **"For this plan"** and changes that plan item only. **Unknown servings**: stepper disabled, "Servings unknown · Set servings" opens a small sheet.

States: as written with things to check [16](screenshots/16-wf-recipe-view-top.png); scaled with notes [17](screenshots/17-wf-recipe-view-scaled.png); from a plan item [18](screenshots/18-wf-recipe-view-from-plan-item.png); unknown servings [19](screenshots/19-wf-recipe-view-unknown-servings.png); delete confirmation, saying what else is affected ("It stays in 2 past plans") [20](screenshots/20-wf-recipe-view-overflow-delete.png). Offline: readable, editing disabled, banner as on Recipes.

### 6.5 Import

Three routes, all in V0.1:

1. **Paste a link**: a sheet with a URL field and Import [21](screenshots/21-wf-import-routes-sheet.png), [22](screenshots/22-wf-import-paste-link.png).
2. **Share from the phone**: on Android the app is in the share sheet and lands on an in-app page; on iPhone an "Add to Finders Eaters" Shortcut (set up once from Settings) ends with a notification that cannot be tapped through, so it says where to look: `Saved "Chicken tikka masala". 4 lines to check in Finders Eaters.` [30](screenshots/30-wf-import-iphone-shortcut-notification.png). The recipe then tops Recipes (Recently added) with its Review marker.
3. **Type one in**: a paste-friendly text form, not a line builder: title, provenance (book and optional page, or "Our recipe"), serves or makes, total time, ingredients one per line, method one step per paragraph [29](screenshots/29-wf-import-type-it-in.png).

After any route the recipe is **already in the library**. Then one of: "Reading the recipe..." (up to about 8 s) [23](screenshots/23-wf-import-reading.png); the review screen when there is something to check; the recipe view when there is not; or "Still being read" [24](screenshots/24-wf-import-still-being-read.png).

Other states: **Couldn't read that page** (nothing saved; reason message; **Type it in** opens the form with the link filled in as provenance) [25](screenshots/25-wf-import-could-not-read.png). Messages: "This site won't let Finders Eaters read it. On iPhone, share it from Safari with the Shortcut; or type it in." / "Couldn't open that page. Check the link, or type the recipe in." / "Couldn't find a recipe on that page. You can type it in." / "That page lists several recipes. Open the one you want and share that." / "That page didn't look like one recipe. You can type it in." **Already in your library**: Open it, or Import again for a second copy [26](screenshots/26-wf-import-already-in-library.png). Android share with no link [27](screenshots/27-wf-import-android-share-no-link.png). Share while offline: "You're offline", link kept in the Paste a link sheet [28](screenshots/28-wf-import-android-share-offline.png). Also design the one-time iPhone Shortcut how-to (it lives in Settings, [92](screenshots/92-wf-settings-device-code-shown-once.png)).

### 6.6 Check this recipe (review and correct)

Prototype `docs/prototypes/recipe-review/index.html`, **variant A chosen** (`?variant=a`).

Lets the household check the app's reading quickly **without ever losing sight of the original text**. One list in recipe order:

1. **Status banner**: "2 lines need a look. ... You can leave this and come back: the recipe is already in your library." Becomes "All checked".
2. **Recipe facts**: servings, total time, unit system and its source ("UK, from bbcgoodfood.com"). A recipe-level question ("How many does this serve?") shows here as a card.
3. **Tags block** "Tags we think fit": suggested tags as dashed chips with remove, effort as a small segmented choice with the engine's pick outlined, one button "Add these N tags".
4. **Lines in recipe order**, section headers kept ("For the marinade"): check card, glance line, clear line or done line (section 5 defines each).
5. **Sticky footer**: "Looks right - confirm N" (glance lines only, 4 s undo), then "Done".

**Edit sheet**: kind (Shop for it / No amount / Not shopped), amount, unit, ingredient (autocomplete over known ingredients only, with "Leave unresolved" as the escape), prep, Save.

States: [31](screenshots/31-proto-review-a-chosen-first-open.png) first open of a fully flagged recipe; [32](screenshots/32-proto-review-a-chosen-check-cards.png) check cards; [33](screenshots/33-proto-review-a-chosen-edit-sheet.png) Edit sheet; [34](screenshots/34-proto-review-a-chosen-bulk-confirm-undo-toast.png) bulk confirm with undo; [35](screenshots/35-proto-review-a-chosen-all-checked.png) and [36](screenshots/36-proto-review-a-chosen-all-checked-bottom.png) all checked; [37](screenshots/37-proto-review-a-chosen-partial-run-still-being-read.png) still being read; [38](screenshots/38-proto-review-a-chosen-dark.png) dark; **[42](screenshots/42-wf-review-current-modes-mostly-clear.png) the now-typical mostly-clear recipe**. Also design: a correction that raises a new question appears in place; an orphaned correction card ("You changed this to X before; this line now reads differently", "Use X again" / "Drop it"); offline (read-only with a note). Rejected variants for context: [39](screenshots/39-proto-review-b-rejected-one-at-a-time.png) one at a time, [40](screenshots/40-proto-review-c-rejected-two-piles.png) and [41](screenshots/41-proto-review-c-rejected-two-piles-scrolled.png) two piles.

Target: a recipe clears in a handful of taps. Design for speed without inviting rubber-stamping: real questions must stand out from probably-right lines.

### 6.7 Sample-check view (new)

Described in section 5. Intro [43](screenshots/43-wf-sample-check-intro.png); in progress [44](screenshots/44-wf-sample-check-in-progress.png); correcting a line with the review Edit sheet [45](screenshots/45-wf-sample-check-correct-sheet.png); complete, counts only [46](screenshots/46-wf-sample-check-done.png). It is an owner task done once (perhaps twice), about 15 minutes, so efficiency matters more than delight. It needs a connection.

### 6.8 Plan and suggestions

Prototype `docs/prototypes/plan-builder/index.html`, **variant A chosen** (inline suggestions with Add all).

One screen for the current plan, suggestions inline below it:

1. **Header**: "Plan", the range if any ("13-19 Oct"), a count ("5 recipes · 3 on a day"), a menu with New plan and Past plans [70](screenshots/70-wf-plan-menu.png).
2. **In the plan**: plan items. A flat list until any item has a day, then grouped under day headers ("Wed 14 Oct") with "Any day" last; with a date range every day shows, empty ones as a thin "Nothing yet" row. Each item: title, time and effort, a **day chip**, a **servings stepper**, remove (4 s undo).
3. **+ Add recipes**: opens Recipes in pick mode.
4. **Suggest bar**: "Suggest [-] 3 [+] more [Dinners v]", a quick "Under 30 min" chip, Filters (the Recipes filter sheet), Suggest.
5. **Suggested** ("Not in the plan until added"): suggestion cards.
6. **Footer** while suggestions show: Clear and **Add all 4**.

**Suggestion cards** must look clearly different from plan items (the prototype uses dashed outlines; any equally clear treatment works): title; time, effort, "Favourite"; **up to two reasons in words**, strongest first; "Why this?"; **Add** (primary), **Another** (replace this card in place with the next best, brief highlight) and **Swap** (a sheet "Instead of Shakshuka" with five alternatives and their reasons plus "Search all recipes"; choosing one adds it straight to the plan).

**Why this?** sheet: every reason, including those against, as **signed bars around a centre line**: bars pulling right ("Uses the rest of the fennel"), bars pushing left ("Another chicken dish", "Cooked 10 days ago"). **No numbers.** With nothing either way it says so ("A first pick: nothing to match yet").

Reasons refresh whenever the plan or the other suggestions change, but a card's recipe changes only by its own Another or Swap. Design a subtle refresh that does not look like the card was replaced.

States: anchor only [47](screenshots/47-proto-plan-a-chosen-anchor-only.png); suggestions [48](screenshots/48-proto-plan-a-chosen-suggestions-shown.png), [49](screenshots/49-proto-plan-a-chosen-suggestion-cards.png); Add all footer [50](screenshots/50-proto-plan-a-chosen-add-all-footer.png); Why this? [51](screenshots/51-proto-plan-a-chosen-why-this-sheet.png); Swap [52](screenshots/52-proto-plan-a-chosen-swap-sheet.png); replaced in place [53](screenshots/53-proto-plan-a-chosen-another-replaced-in-place.png); one added [54](screenshots/54-proto-plan-a-chosen-one-added.png); day picker [55](screenshots/55-proto-plan-a-chosen-day-picker-sheet.png); grouped by day [56](screenshots/56-proto-plan-a-chosen-grouped-by-day.png); filters (placeholder, real sheet is 6.3) [57](screenshots/57-proto-plan-a-chosen-filters-placeholder.png); after Add all [58](screenshots/58-proto-plan-a-chosen-after-add-all-undo-toast.png); remove with undo [59](screenshots/59-proto-plan-a-chosen-remove-undo-toast.png); first run [60](screenshots/60-proto-plan-a-chosen-first-run-no-plan.png); first picks [61](screenshots/61-proto-plan-a-chosen-cold-start-suggestions.png); dated plan [62](screenshots/62-proto-plan-a-chosen-dated-plan-empty-days.png); small library [63](screenshots/63-proto-plan-a-chosen-tiny-library-suggestions.png); pool running out "Only 5 dinners left to suggest" [64](screenshots/64-proto-plan-a-chosen-pool-running-out.png); pool empty "No dinners left to suggest" with a link to Recipes [65](screenshots/65-proto-plan-a-chosen-pool-empty.png); dark [66](screenshots/66-proto-plan-a-chosen-dark.png). Rejected: one at a time [67](screenshots/67-proto-plan-b-rejected-one-at-a-time.png); day board [68](screenshots/68-proto-plan-c-rejected-day-board.png), [69](screenshots/69-proto-plan-c-rejected-day-board-scrolled.png).

**Plan lifecycle**: **New plan** sheet with date chips (This week, Next 7 days, Pick dates, No dates) and "Bring over 3 recipes not cooked yet", ticked by default ("not cooked yet" = no day, or dated today or later) [71](screenshots/71-wf-plan-new-plan-sheet.png). A **finished-plan banner**, dismissible: "This plan ended on Sun 19 Oct · Start a new plan" or, without a range, "Everything in this plan has had its day · Start a new plan"; a plan never ends on its own [72](screenshots/72-wf-plan-finished-banner-ranged.png). **Past plans**: a list by date range [73](screenshots/73-wf-plan-past-plans-list.png); opening one shows the same screen with "Past plan · Go to current plan", still editable (days, servings, removing), no suggestions [74](screenshots/74-wf-plan-past-plan-open.png).

### 6.9 Shopping

Prototype `docs/prototypes/shopping-list/index.html`, **variant A chosen** ("Aisles, ticked items move away").

The list for the current plan, used one-handed in a shop. It covers every item in the plan whatever its day; ticks reset only when a new plan starts.

- **Header**: "Shopping", the plan's dates and recipe count. **Footer**: "9 of 23 to get" with a progress bar.
- **One row per ingredient** under sticky **aisle headers** in a fixed walk order: Fruit & veg, Bakery, Meat & fish, Dairy & eggs, Cupboard, Spices & seasonings, Oils, sauces & condiments, Frozen, Other. Empty aisles hidden.
- Each row: name; amount right-aligned ("400 g", "40 g + some", "800 ml + 1 cube", "800 g · 2 tins", "3 onions"); a **source line** naming the recipes ("Chilli 1 · Dal 2 · Pasta 1", "Chilli · serve with", "Dal · to taste"). No amount, no amount shown.
- **Badges**: "serve with" (a carb added because a recipe is served with it) and "was 4" (the plan changed and needs more than was ticked, so the row came back); "optional" when every contribution is optional.
- **Ticking**: whole row is the target. A ticked row strikes through and fades in place for about 1.3 s, then moves to a collapsed **In the basket** section at the bottom. Undo toast for 4 s. No swipe, no long press.
- **At home**: always-haves (oil, salt, pepper) start ticked in a collapsed section, "6 always-have · tap one if you are out"; tapping one returns it to its aisle for this shop. Ticks carried over from the last plan sit here too, noted "Bought for last plan".
- **Offline**: amber banner "Offline · 3 ticks saved on this phone" and "List as of 10:42"; everything keeps working; on reconnect a brief "Synced".

States: fresh [75](screenshots/75-proto-shop-a-chosen-fresh-list.png); tick settling [76](screenshots/76-proto-shop-a-chosen-tick-settling.png); moved with undo [77](screenshots/77-proto-shop-a-chosen-ticked-moved-undo-toast.png); At home and In the basket [78](screenshots/78-proto-shop-a-chosen-in-basket-and-at-home-open.png); offline [79](screenshots/79-proto-shop-a-chosen-offline-ticks-queued.png); synced [80](screenshots/80-proto-shop-a-chosen-back-online-synced.png); plan grew, "was N" [81](screenshots/81-proto-shop-a-chosen-plan-grew-was-n.png); partner's tick after refresh [82](screenshots/82-proto-shop-a-chosen-partner-tick-after-refresh-basket.png); everything ticked ("All in the basket") [83](screenshots/83-proto-shop-a-chosen-all-in-basket.png); dark [84](screenshots/84-proto-shop-a-chosen-dark.png); empty "Nothing to buy yet" [87](screenshots/87-wf-shop-nothing-to-buy.png); carried ticks [88](screenshots/88-wf-shop-carried-over-at-home.png); past plan's list, read-only [89](screenshots/89-wf-shop-past-plan-read-only.png). Rejected: one at a time [85](screenshots/85-proto-shop-b-rejected-one-at-a-time.png); checklist, ticked stay put [86](screenshots/86-proto-shop-c-rejected-checklist-ticked-stay-put.png).

### 6.10 Settings

From the Recipes header. A plain list: **Household** (default servings stepper, "Serves 2"); **Always have** (removable list, "Add" autocomplete, "These start ticked on every shopping list."); **Import from iPhone** (devices with label and "Last used 3 Oct" or "Never used", Revoke with confirmation; "Add a device" asks for a label, then shows the device's import code **once** with Copy, "Get the Shortcut" and a short how-to: Settings > Apps > Shortcuts > Advanced > Allow Running Scripts, the optional Allow Sharing Large Amounts of Data, and the first-run prompts to allow it to connect); **Account** (email, Change password, Sign out, Sign out of other devices).

States: main [90](screenshots/90-wf-settings-main.png); add device [91](screenshots/91-wf-settings-add-device-label.png); code shown once [92](screenshots/92-wf-settings-device-code-shown-once.png); revoke [93](screenshots/93-wf-settings-revoke-confirm.png).

### 6.11 Key flows end to end

1. **Import to review**: Recipes (+) > Paste a link > Import > "Reading the recipe..." > Check this recipe (if anything to check) > answer the questions, add tags > Done > recipe view. Or iPhone: Safari share > Shortcut > notification > later, open the app > Recipes, top row with Review marker > recipe view banner > Check this recipe.
2. **Find**: Recipes > type "chick" > pick "Main protein: Chicken" > Filters > Time 30 min, exclude Pork > Show 12 recipes > open one > scale to 6.
3. **Plan**: Plan > + Add recipes > pick mode, add two > Done > Suggest 3 more dinners > read reasons, Why this? on one > Another on one, Swap on another > Add all > set days with day chips > adjust servings.
4. **Shopping list**: Shopping > the list is computed from the plan (nothing to generate) > At home already ticked.
5. **In the shop**: tick rows one-handed > signal drops (offline banner, ticks queue) > partner ticks beef mince on their phone > signal returns ("Synced") > refresh shows the partner's tick > "All in the basket".
6. **Next week**: finished-plan banner > Start a new plan > Next 7 days, bring over 2 not cooked > the new list starts fresh with carried ticks under At home.
7. **After the library import (owner, once)**: sample-check view > 150 lines > Right or Correct it > done.

## 7. Content and copy rules

- **UK English**: favourite, colour, courgette, coriander, aubergine, tin (not can) in our own copy. Recipe text is shown exactly as written, whatever its spelling.
- **Metric first**: "400 g", "150 ml", "1.2 kg", "1 l"; spoons stay spoons; natural counts ("2 onions", "1 lemon"). Non-metric lines keep their text with a muted metric hint. No unit setting in V0.1.
- **Dates**: "Wed 14 Oct", ranges "13-19 Oct", "12 Sept". Times "1 hr 10 min", "25 min".
- **Sentence case** everywhere. Buttons are verbs ("Add", "Add all 4", "Confirm 12", "Show 18 recipes"). Headings short ("Check this recipe", "In the basket").
- **No exclamation marks, no emoji, no "Oops".** Errors say what happened and what to do next.
- **Words to use in the UI**, from the project glossary (`CONTEXT.md`):

| Use | Never use | Notes |
|---|---|---|
| Recipe | Dish, meal | "Meal" is a tag dimension (Dinner, Lunch), not a recipe |
| Recipes, your library | Collection, cookbook, recipe box | "Collection" is reserved for a later feature |
| Plan | Meal plan, week, schedule | Header says "Plan"; a plan may have no dates |
| Current plan, past plan | Active plan, this week | |
| Suggestion, reason ("Why this?") | Recommendation, explanation, score | |
| Another | Dismiss, reject | Skips one suggestion in place |
| Swap | Replace, substitute | |
| Shopping list, Shopping | Grocery list | |
| Tick, ticked | Check, done | For shopping rows ("check" belongs to review) |
| Always have | Pantry, staples, inventory | |
| Aisle names (Fruit & veg, ...) | Category, department | |
| Serve with | Side, accompaniment | |
| Provenance shown as "From BBC Good Food", "Our recipe" | Source | In copy, just state where it is from |
| Things to check, Check this recipe | Errors, warnings, issues, problems | Uncertainty is not failure |
| Tag, Your tags | Category, label, custom tag | |
| Household | Family, team, account | "Account" only for the person's sign-in |
| Import code (Settings) | API key | Internally an import token |
| Servings, "x1.5" badge | Multiplier | |
| Optional | Garnish | |

## 8. Components to design

- Bottom navigation (three items); top bar with title, count and actions.
- Recipe row (heart, Review marker); plan item row (day chip, servings stepper, remove); shopping row (tap target, amount, source line, badges, ticked, settling and read-only states).
- Chips: plain, removable, **tri-state** (off, include, exclude), dashed "suggested", day chip, badge.
- Suggestion card with reasons and three actions, and its "replaced in place" highlight.
- Signed reason bar (positive, negative, both themes).
- Review line in four densities: check card, glance row, clear line, done line; field chips (amount, size, ingredient, prep) including an unsure ingredient chip ("?") and a parent match ("≈ Cheese"); sample-check line card with Right / Correct it.
- Segmented choice; stepper (with disabled state); select; search field with typeahead; autocomplete field.
- Bottom sheet (partial and full height) with a sticky footer button; menu.
- Banners: info, offline (amber), synced, past plan, finished plan; status banner on review.
- Toast with Undo.
- Collapsible section header (In the basket, At home); sticky aisle and day headers.
- Skeleton rows; inline empty state; progress bar.
- Form fields: text, multi-line, inline error.

## 9. Fixed vs open

**Fixed (do not redesign the behaviour):** the chosen variants' flows (review A, plan A, shopping A); the three-tab navigation with Recipes as start; bottom sheets for secondary tasks; everything in "What must always be visible"; the text-only rows; the review densities and that bulk confirm covers glance lines only; the tri-state filter behaviour; reasons in words and signed bars without numbers; whole-row ticking with move-away and undo; offline only on the shopping list; all copy quoted in this brief (you may suggest better wording, flagged as a suggestion).

**Open (your call):** the visual identity (colour, type, shape, density, iconography) within the legibility and contrast rules; how suggestions differ from plan items (dashed is one answer); how a first-time user learns the exclude tap; how refreshed reasons update quietly; the sample-check view's layout (scrolling list or one card at a time) and its **entry point** (a Settings row, a banner on Recipes once the library import is done, or both); whether the pool-running-out message is a toast or inline; whether Always have deserves its own screen; header layouts; motion within reduced-motion rules; a simple text wordmark for the working name.

**Out of scope:** recipe images and image slots; cookbook scanning, photo or barcode import; link packs, starter recipes, onboarding tours, marketing pages; ratings, notes, cooking mode, sharing a recipe; similar recipes, "what can I make with", natural-language search, saved collections; presets, dismiss with a reason, leftovers, meal grouping, hard planning rules; free-text shopping items, buyable-pack rounding, choosing a shop; inviting people, roles, household members, presence; unit and locale settings; a logo or brand identity; native app chrome.

## 10. What we want back

1. **Design tokens**, small and complete enough that the build restyles by tokens alone:
   - Colour: semantic roles for light and dark (background, surface, raised surface, text, muted text, border, accent and on-accent, focus ring, info, offline/warning, success/synced, danger, highlight for the uncertain span, positive and negative reason bars, scrim). Every text/background pair at AA.
   - Type: families (with web-font source), a scale of about 6 steps (size, line height, weight), tabular numerals for amounts.
   - Spacing: a scale (for example 4, 8, 12, 16, 24, 32).
   - Radius: about 3 steps plus pill.
   - Also, if you define them: elevation (shadows for sheets and toasts), motion durations and easings, touch-target minimums.
   - Format: W3C design tokens JSON (`tokens.json`) or CSS custom properties; names semantic (`color.surface.raised`), not literal (`green-500`).
2. **Screens at phone width (390 x 844)** for every screen and state in section 6, light mode, plus dark for Recipes, Plan, Shopping and Check this recipe. Name them like the screenshots here (`NN-screen-state.png`) so each maps to its predecessor.
3. **A component sheet** showing the components in section 8 in their states, in both themes.
4. **Notes** on anything you changed or questioned, especially the open items in section 9 and the questions in [`screenshots/INDEX.md`](screenshots/INDEX.md).
5. Optional: one wide layout each for Recipes and Plan.

Fidelity: high-fidelity static screens using the realistic sample content below, not lorem ipsum.

## 11. Sample content

**Library** (a household of 2, about 120 recipes):

| Title | Time | Effort | Cuisine | Provenance | Last cooked |
|---|---|---|---|---|---|
| Chicken tikka masala | 1 hr 10 min | Medium | Indian | BBC Good Food | 5 weeks ago |
| Chilli con carne | 1 hr 30 min | Easy | Mexican | BBC Good Food | 3 weeks ago |
| Tarka dal | 40 min | Easy | Indian | RecipeTin Eats | 10 days ago |
| Lemon roast chicken | 1 hr 30 min | Easy | British | Our recipe | 6 weeks ago |
| Pasta e ceci | 35 min | Easy | Italian | Jamie Oliver | Never |
| Fennel and sausage pasta | 30 min | Easy | Italian | Weeknight Kitchen, page 112 | 2 weeks ago |
| Fish tacos | 25 min | Easy | Mexican | RecipeTin Eats | 7 weeks ago |
| Chicken, leek and tarragon pie | 45 min | Medium | British | BBC Good Food | 3 weeks ago |
| Leek and potato soup | 50 min | Easy | British | Our recipe | 2 months ago |
| Thai green curry | 35 min | Medium | Thai | RecipeTin Eats | 4 weeks ago |
| Mushroom risotto | 45 min | Medium | Italian | Jamie Oliver | Never |
| Shakshuka | 30 min | Easy | Middle Eastern | BBC Good Food | 9 weeks ago |

**Suggestion reasons**, positive: "Uses the rest of the fennel from Fennel and sausage pasta", "Shares lime and coriander with Fish tacos", "A favourite", "Not had in 7 weeks", "Quick: 25 min". Negative (Why this? only): "Another chicken dish", "Second pasta this week", "Cooked 10 days ago". Fresh: "A first pick: nothing to match yet".

**Review questions** on Chicken tikka masala (BBC Good Food, 17 lines, sections "For the marinade" and "For the sauce"): "a thumb-sized piece of ginger" asks "How much ginger?"; "25g butter" asks "Which butter?" (Unsalted, Salted, Butter (any)); "coriander, to serve" asks "Buy this, or is it optional garnish?"; "salt and pepper, to taste" is a glance line (one line or two ingredients?); "1 tbsp garam masala" is a clear line.

**Sample check lines**: "2 x 400g cans chopped tomatoes" read as 800 g · 2 tins Chopped tomatoes; "1 lime, juiced, plus wedges to serve" (a correction: 1 lime + some); "250g red lentils, rinsed".

**Shopping list** for Chilli con carne, Tarka dal, Lemon roast chicken and Pasta e ceci: Onions "3 onions" (Chilli 1 · Dal 1 · Pasta 1); Garlic "9 cloves"; Lemons "2 lemons"; Beef mince "500 g"; Whole chicken "1.6 kg"; Chopped tomatoes "800 g · 2 tins" (Chilli 1 · Pasta 1); Red lentils "250 g"; Chickpeas "400 g · 1 tin"; Rice, no amount, "serve with" (Chilli · serve with); Parmesan "40 g + some"; Kidney beans "400 g · 1 tin"; At home: olive oil, vegetable oil, salt, black pepper, cumin, ground turmeric.

## Reference files

| What | File | Notes |
|---|---|---|
| Review and correct | `docs/prototypes/recipe-review/index.html` | Variant A (`?variant=a`) chosen. Predates the current engine modes; percentages on answers are an artefact |
| Plan with suggestions | `docs/prototypes/plan-builder/index.html` | Variant A chosen. "library of 24" in the header is a debug count; its Filters sheet is a placeholder |
| Shopping in the shop | `docs/prototypes/shopping-list/index.html` | Variant A chosen. Title should read "Shopping" |
| Wireframes | `docs/design-handoff/wireframes/*.html` | Throwaway greyscale; structure only |
| Specs | `docs/spec/v0.1.md` and the area specs it lists | The source of truth |

Each prototype opens in a browser with no build step and has a variant switcher and scenario buttons beside the phone frame.
