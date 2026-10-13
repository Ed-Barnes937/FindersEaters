# Design brief: Finders Eaters V0.1

The brief for the first app designs, to be taken to Claude Design. It is self-contained: everything a designer needs is on this page, plus the three prototype files listed under [Reference prototypes](#reference-prototypes), which should be attached alongside it.

Resolves [Write the Claude Design brief](https://github.com/Ed-Barnes937/FindersEaters/issues/17). Sources: `docs/spec/search-and-library.md`, `docs/spec/recipe-review.md`, `docs/spec/planner-screen.md`, `docs/spec/shopping-list.md`, the feature cut on [Agree the V0.1 feature cut](https://github.com/Ed-Barnes937/FindersEaters/issues/2), and the glossary in `CONTEXT.md`. Where this brief and a spec disagree, the spec wins and this brief should be corrected.

---

## 1. The product in one paragraph

Finders Eaters (a working name) is a recipe book that understands its recipes. A household brings in the recipes it already cooks, from recipe websites or typed in from a cookbook or its own notes, and the app reads each one into a consistent structured form: every ingredient line becomes an amount, a unit, a known ingredient and its prep, and every recipe is tagged (meal, cuisine, main protein, carb, method, effort, equipment, diet). That makes the collection properly searchable, and it lets the app help with the weekly chore: deciding what to cook. It suggests recipes that fit around the ones already chosen, **says why it suggests each one**, and turns the plan into a shopping list, merged across recipes and sorted by aisle, that already knows you have oil.

## 2. Who it is for

- **One UK household first**: two adults who cook most evenings from a library of roughly 50 to 150 recipes, mostly from BBC Good Food, RecipeTin Eats, Jamie Oliver and a few cookbooks. Both use the same household library, plan and list.
- **The context of use matters more than the persona.** The app is used in three very different moments:
  1. **On the sofa, planning** (Sunday evening, unhurried, two people looking at one phone): browse, pick a few, let the app fill the rest.
  2. **In the shop** (one hand on a trolley, poor signal, interrupted, sometimes two people splitting up): tick things off fast, never lose the list.
  3. **Just after finding a recipe online** (on a phone, mid-scroll): import it in a couple of taps, fix anything the app was unsure of, move on.
- They are not food-tech enthusiasts. They want fewer decisions, not more features.

## 3. What we are asking Claude Design for

1. **A small design system**: colour tokens (light and dark), type scale, spacing, radii, elevation, and the components listed in [section 8](#8-components). It will be built with SCSS modules over Base UI (unstyled, accessible React primitives), so components should map to ordinary primitives: dialog and bottom sheet, select, menu, toggle, tabs, toast, popover, autocomplete.
2. **Every screen in [section 6](#6-screens-and-flows) at phone size** (390 x 844), in light mode, with dark mode for the Recipes, Plan and Shopping screens at least.
3. **The states listed per screen**: empty, loading, error, offline and the in-between moments (undo toasts, a card being replaced). States are where this app earns trust, so they are not optional extras.
4. **One wide layout** (tablet or desktop) of the Recipes screen and the Plan screen only, to show how the system scales. Mobile is the priority; wide layouts are a sketch.

Fidelity: high-fidelity static screens, using the realistic sample content in [section 10](#10-sample-content), not lorem ipsum.

## 4. Platform and constraints

- **Mobile first**, then tablet, then desktop, for every interaction. Design at 390 px wide; nothing may require a hover.
- **An installable web app (PWA)**, not a native app. It runs full screen from the home screen on Android and iPhone. Respect safe areas (notch, home indicator). No native-only patterns (no iOS swipe-to-delete, no Android FAB conventions that assume Material).
- **Bottom navigation with three destinations**: Recipes, Plan, Shopping. Recipes is the start screen.
- **Thumb zone**: primary actions sit low (sticky footers, bottom sheets, toasts above the nav). Top-of-screen controls are for navigation and less frequent actions.
- **Bottom sheets, not modals**, for secondary tasks (filters, why this, swap, edit a line, pick a day, new plan). On a phone the filter sheet is full height.
- **Touch targets** at least 44 px; shopping list rows at least 60 px.
- **Text first.** V0.1 shows no recipe images anywhere (rows, recipe view, plan, list). Design for dense, scannable text rows; do not leave image slots.
- **Only the shopping list works offline.** Everything else shows an offline banner and stays readable but not editable.
- **No real-time sync**: a second phone's changes appear on load or refresh. Do not design presence indicators or live cursors.
- **Accessibility**: WCAG 2.2 AA contrast in both themes; colour is never the only signal (a tri-state chip uses a minus sign as well as styling; a reason bar also has its label and a sign); respect reduced motion (the shopping list's "move away" animation becomes an instant move).
- **UK English and UK conventions**: metric units ("400 g", "150 ml"), natural counts ("2 onions"), dates as "Wed 14 Oct", "13-19 Oct". British spelling (favourite, colour, courgette, coriander).

## 5. Tone

- **Calm, plain and practical.** A well-organised friend in the kitchen, not a lifestyle brand and not a productivity app. No exclamation marks, no gamification, no streaks, no confetti, no emoji.
- **Honest about uncertainty.** The app is sometimes unsure, and says so plainly ("How much ginger?", "Still being read"). It never pretends to know. Missing facts are left out, never shown as "unknown".
- **It explains itself.** Every suggestion says why, in words a person would use ("Uses the rest of the fennel from Fennel and sausage pasta", "Not had in 7 weeks"). No scores, percentages or star ratings anywhere.
- **Short copy, sentence case.** Buttons are verbs ("Add", "Add all 4", "Confirm 12", "Show 18 recipes"). Headings are short ("Check this recipe", "In the basket").
- **Visual mood**: warm, readable and quiet, something you are happy to look at in a kitchen at 6 pm and in a bright supermarket. Legibility beats character; one restrained accent colour; plenty of contrast. The prototypes use a sage green accent with Atkinson Hyperlegible for UI text and Bricolage Grotesque for headings; that is a reasonable starting point, not a requirement. Feel free to propose something better that keeps the legibility.

## 6. Screens and flows

The three prototypes already lock the flows and behaviour of the review, plan and shopping screens. They are **throwaway behavioural mocks**: copy their structure, content and interactions, and redesign their look freely.

### 6.1 Recipes (library and search)

The library and search are **one screen**. An empty query shows the whole library; typing or filtering narrows it. The planner reuses this exact screen as its recipe picker.

Top to bottom:

1. **Header**: "Recipes", a count ("124 recipes", or "12 of 124" while filtering), an import (+) button, and a settings entry (see 6.8).
2. **Search box**: placeholder "Search recipes". Bare words search titles.
3. **Typeahead** while a word is being typed: "Title contains *chick*" (default), then "Main protein: Chicken", "Ingredient: chicken", "Ingredient: chickpeas", "Tag: chicken nights". Picking one turns it into a chip.
4. **Active chips** in plain English ("Italian or Thai", "Not pork", "Under 30 min", "With fennel", "Without dairy", "Favourites", "Not cooked in 2 weeks"), each removable; tapping one opens the filter sheet at its row. "Clear" when two or more are active.
5. **Controls row**: Filters button with an active count, and a sort select (Recently added, A to Z, Quickest, Longest since cooked).
6. **Result list** of text rows:

```
Chicken, leek and tarragon pie                 ♥
45 min · Medium · British
BBC Good Food · Cooked 3 weeks ago        Review
```

   Title (up to two lines, matched words in bold), a facts line (time, effort, cuisine; any missing fact simply left out), a provenance and last-cooked line, a heart toggle, and a small "Review" marker while the recipe has things to check.

**States**: empty library ("No recipes yet" plus the three import routes as buttons, no search box); no matches (chips stay, "No recipes match these filters", each chip repeated as a removable button, Clear all; no guessing); parse error in a typed query (the bad span underlined, the message under the box, a tappable "did you mean" fix, no results shown); first load (skeleton rows); later loads (previous results dimmed, never flashing empty); offline ("You're offline. Recipes need a connection.", loaded results stay openable, filtering disabled).

**Pick mode** (from the planner's "+ Add recipes"): the same screen with a header like "Add to plan" and a Done action; each row gains an add control; tapping the row body still opens the recipe.

### 6.2 Filter sheet

A full-height bottom sheet: "Filters" header, "Clear all", and a sticky footer button "Show N recipes" (live count; "No recipes" at zero). Results behind it update live.

Rows in this order: Quick (Favourites, Not cooked in 2 weeks, Not cooked in 4 weeks), Meal, Time (15 min, 30 min, 45 min, 1 hour, Any), Main protein, Carb, Cuisine (collapsed to two lines with "More"), Diet, Ingredients (two autocomplete fields, "With" and "Without"), Effort, Method, Equipment, Your tags.

- **Tri-state chips** cycle off, include, exclude. Include is filled. Exclude is outlined with a minus and a struck-through label ("- Pork"). This is the one novel control in the app; please design it carefully, including how a first-time user learns that a second tap excludes.
- A row only shows values the library actually has, so rows are short. There is no "Unknown" chip.
- **The dietary note sits directly under the Diet row label, always visible**: "A guide, not allergen safety. Check packaged ingredients like stock and soy sauce."
- Ingredient autocomplete shows the name plus its parent for disambiguation ("Cream, dairy") and matches synonyms (coriander, cilantro).

### 6.3 Recipe view

Top to bottom: back, title, heart, overflow menu (Review and correct, Delete); provenance in full ("From BBC Good Food", linking out; "Weeknight Kitchen, page 112"; "Our recipe"); a "3 things to check" banner when there are open flags; facts (total time, servings, effort, "Last cooked 12 Sept" or "Not cooked yet"); tags as labelled chip groups (Meal, Cuisine, Main protein, Carb, Method, Effort, Equipment, Diet), each chip a link back into search, the dietary note directly under any diet chips, and an "Edit tags" link; "Your tags" (household's own free-form tags, removable, "+ Add tag"); ingredients with section headers; method as numbered steps; a sticky **Add to plan** button.

Servings on this view are a scaling control, defined in [Define recipe scaling rules](https://github.com/Ed-Barnes937/FindersEaters/issues/25) (`docs/spec/scaling.md`):

- A **servings stepper** ("4 servings", or for a "makes" recipe "12 buns", stepping in half or whole batches) with a small **factor badge** ("x1.5") when it is not as written. Opened from a plan item, it is labelled "For this plan" and changes that plan item; otherwise it only changes this view.
- At x1 the ingredient lines show the original text. Scaled, only the amount changes ("1½ tins" becomes "3 tins").
- **Scaling notes** inline under a line that does not scale cleanly: "Rounded from 1½", "Part tin - keep the rest", "Start with less and add to taste". Plus one quiet recipe-level line when scaled: "Times and tin sizes are as written".
- **Unknown servings**: the stepper is disabled and reads "Servings unknown · Set servings", which opens a small sheet to say how many it serves.

Delete asks for confirmation and says what else is affected ("It stays in 2 past plans").

### 6.4 Import

Three routes, all in V0.1:

1. **Paste a link**: a sheet with a URL field and "Import".
2. **Share from your phone**: on Android the app appears in the share sheet; on iPhone an "Add to Finders Eaters" Shortcut does the same (set up once from Settings, see 6.8) and ends with a notification that cannot be tapped through to the app, so it says where to look: `Saved "Chicken tikka masala". 4 lines to check in Finders Eaters.` (the recipe then tops the library under Recently added with its needs-review marker). Design the in-app landing after an Android share, its states for a share with no link ("That share didn't include a link", with Type it in) and for offline ("You're offline", the link kept in the Paste a link sheet), and the one-time Shortcut setup how-to.
3. **Type one in**: a form for a cookbook or the household's own recipe: title, provenance (book title and optional page, or "Our recipe"), serves or makes, total time, ingredients (one per line, in a plain multi-line field), method (one step per paragraph). It is deliberately a paste-friendly text form, not a structured line-by-line builder: the engine does the structuring.

After any route, the recipe is **already in the library**. The app then shows one of: "Reading the recipe..." (a short wait), the review screen when there is something to check (the usual case at first), or the recipe view when there is not. Also design:

- **"Couldn't read that page"**: nothing is saved. It shows the reason's message and a **Type it in** button that opens the form with the link already filled in as provenance. The messages: "This site won't let Finders Eaters read it. On iPhone, share it from Safari with the Shortcut; or type it in.", "Couldn't open that page. Check the link, or type the recipe in.", "Couldn't find a recipe on that page. You can type it in.", "That page lists several recipes. Open the one you want and share that." and "That page didn't look like one recipe. You can type it in."
- **Already in your library**: the link matches a recipe the household already has. **Open it**, or **Import again** to save a second copy.
- **Still being read**: original lines shown, no actions.

The plumbing behind these is in `docs/spec/import-capture.md`; design the states, not the plumbing.

### 6.5 Check this recipe (review and correct)

Prototype: `docs/prototypes/recipe-review/index.html` (variant A, `?variant=a`, is the chosen one).

The engine is sometimes unsure. This screen lets the household check its reading quickly **without ever losing sight of the original text**. One list in recipe order, in two densities:

1. **Status banner**: "4 lines need a look, 12 probably right. You can leave this and come back: the recipe is already in your library." Becomes "All checked".
2. **Recipe facts**: servings, total time, unit system with its source ("UK, from bbcgoodfood.com"). A recipe-level question ("How many does this serve?") shows here as a card.
3. **Tags block**, "Tags we think fit": suggested tags as dashed chips with a remove (✕), a below-confidence dimension as a small segmented choice with the engine's pick outlined (for example effort: Easy / **Medium** / Hard), and one button "Add these 5 tags".
4. **Ingredient lines in recipe order**, section headers kept ("For the marinade"). Each line is one of:
   - **Check line**: an expanded card. The original line with the uncertain span highlighted, the engine's reading as field chips (amount, size, ingredient, prep), the question in words ("How much ginger?", "Which butter?", "Buy this, or is it optional garnish?"), up to three one-tap answers, and Edit.
   - **Glance line**: a compact row, the original text over a short reading ("4 Chicken breast"), and a round tick button.
   - **Clear line**: muted original text ("not shopped" for things like "a splash of water"); tap to expand and edit.
   - **Done line**: muted with a small tick.
5. **Sticky footer**: "Looks right - confirm 12" (covers glance lines only, with a 4 s undo toast), then "Done".

The **Edit sheet** (bottom sheet): kind (Shop for it / No amount / Not shopped), amount, unit, ingredient (autocomplete over known ingredients only, with "Leave unresolved" as the escape), prep, Save.

**States**: a correction that raises a new question appears in place; an orphaned correction card ("You changed this to X before; this line now reads differently", "Use X again" / "Drop it"); offline (read-only with a note); a partial read ("Still being read").

The target: a typical 17-line recipe clears in about 7 taps. Design for speed without inviting rubber-stamping: the real questions must stand out from the probably-right lines.

### 6.6 Plan

Prototype: `docs/prototypes/plan-builder/index.html` (variant A is the chosen one).

One screen for the current plan, with suggestions inline below it.

1. **Header**: "Plan", the range if any ("13-19 Oct"), a count ("5 recipes · 3 on a day"), and a menu with New plan and Past plans.
2. **In the plan**: plan items. A flat list until any item has a day, then grouped under day headers ("Wed 14 Oct") with "Any day" last. With a date range, every day in the range shows, empty ones as a thin "Nothing yet" row. Each item: title, time and effort, a **day chip** ("Any day" / "Wed 14 Oct"), a **servings stepper** ("4 servings", "As written"), and remove (4 s undo).
3. **+ Add recipes**: opens Recipes in pick mode.
4. **Suggest bar**: "Suggest [-] 3 [+] more [Dinners v]", a quick "Under 30 min" chip, Filters (the same filter sheet as Recipes), and Suggest.
5. **Suggested** ("Not in the plan until added"): suggestion cards.
6. **Footer** while suggestions show: Clear and **Add all 4**.

**Suggestion cards** must look clearly different from plan items (the prototype uses dashed outlines; any equally clear treatment is fine): they are proposals, not commitments. Each card: title; time, effort and "Favourite"; **up to two reasons in words**, the strongest first; a "Why this?" link; and actions **Add** (primary), **Another** (replace this card with the next best, in place, with a brief highlight) and **Swap** (a sheet "Instead of Shakshuka" listing five alternatives with their reasons and a "Search all recipes" row; choosing one adds it straight to the plan).

**Why this?** is a bottom sheet listing every reason, including the ones that count against it, as **signed bars around a centre line**: green bars pull right ("Uses the rest of the fennel"), red bars push left ("Another chicken dish", "Cooked 10 days ago"). **No numbers.** When nothing pulled either way it says so in words ("A first pick: nothing to match yet").

Reasons refresh whenever the plan or the other suggestions change (they describe what is on screen now), but a card's recipe changes only by its own Another or Swap. Design a subtle way for refreshed reasons to update without looking like the card was replaced.

Also design: the **day picker** sheet ("Any day" plus a grid of the plan's days, or the next 14 days); the **New plan** sheet (date chips "This week", "Next 7 days", "Pick dates", "No dates", and "Bring over 3 recipes not cooked yet", ticked by default; "not cooked yet" means without a day or dated today or later); **first run** (no plan yet: just the suggest bar and "+ Add recipes"); **pool running out** ("Only 3 dinners left to suggest", or "No dinners left to suggest" with a link to Recipes); **Past plans** (a simple list by date range); and the **finished-plan banner**, dismissible, at the top of Plan once a plan is finished, inviting a new plan: "This plan ended on Sun 19 Oct · Start a new plan" for a ranged plan, and "Everything in this plan has had its day · Start a new plan" for one without a range. A plan never ends on its own.

Opening a past plan shows the same screen with a banner "Past plan · Go to current plan". Past plans stay editable (days, servings, removing items), but no suggestions are offered there and their shopping list is read-only. Rules: [Define the plan lifecycle and what a shopping list covers](https://github.com/Ed-Barnes937/FindersEaters/issues/26) (`docs/spec/plan-lifecycle.md`).

### 6.7 Shopping

Prototype: `docs/prototypes/shopping-list/index.html` (variant A, "Aisles, ticked items move away", is the chosen one).

The list for the current plan, used one-handed in a shop. It covers every item in the plan, whatever its day, and ticks reset only when a new plan starts.

- **Header**: "Shopping", the plan's dates and recipe count. **Footer**: "9 of 23 to get" with a progress bar.
- **One row per ingredient**, grouped under sticky **aisle headers** in a fixed walk order: Fruit & veg, Bakery, Meat & fish, Dairy & eggs, Cupboard, Spices & seasonings, Oils, sauces & condiments, Frozen, Other. Empty aisles hidden.
- Each row: the name, the amount right-aligned ("400 g", "40 g + some", "800 ml + 1 cube", "800 g · 2 tins", "3 onions"), and a **source line** under the name naming the recipes it comes from ("Chilli 1 · Dal 2 · Pasta 1", "Chilli · serve with", "Dal · to taste"). Rows with no amount show none.
- **Badges**: "serve with" (a carb added because a recipe is served with it, such as rice for a chilli) and "was 4" (the plan changed and now needs more than was ticked, so the row came back).
- **Ticking**: the whole row is the tap target. A ticked row strikes through and fades in place for about 1.3 s, then moves to a collapsed **In the basket** section at the bottom. An **Undo** toast sits low for 4 s. No swipe, no long press.
- **At home**: always-have items (oil, salt, pepper) start ticked in a separate collapsed section, "6 always-have · tap one if you are out". Tapping one returns it to its aisle for this shop only. Ticks carried over from the last plan (bought for recipes that were brought over) also sit here, each with the note "Bought for last plan"; tapping one returns it to its aisle.
- **Offline**: an amber banner "Offline · 3 ticks saved on this phone" and "List as of 10:42" in the header; everything keeps working. On reconnect a brief "Synced".
- **Empty**: no plan or an empty plan ("Nothing to buy yet", link to Plan); everything ticked ("All in the basket").
- **Past plan's list**: the same layout, read-only (no ticking), with the "Past plan · Go to current plan" banner.

### 6.8 Settings

Reached from the Recipes header. A plain list screen:

- **Household**: default servings (a stepper, "Serves 2").
- **Always have**: the household's always-have ingredients as a removable list, with an "Add" autocomplete over known ingredients. A short explanation: "These start ticked on every shopping list."
- **Import from iPhone**: a list of devices that can add recipes, each with its label ("Ed's iPhone") and "Last used 3 Oct" or "Never used", and Revoke (with confirmation). "Add a device" asks for a label, then shows the device's import code **once**, with Copy, a "Get the Shortcut" link and a short how-to (including the one-time step: Settings > Apps > Shortcuts > Advanced > Allow Running Scripts); the code cannot be shown again, only revoked and replaced.
- **Account**: the signed-in person's email, Change password, Sign out and "Sign out of other devices".

### 6.9 Sign in

A minimal sign-in screen with the working name, email and password fields and one primary **Sign in** button ([Decide auth, sign-in and import tokens](https://github.com/Ed-Barnes937/FindersEaters/issues/20), `docs/spec/auth.md`). There is **no sign-up link**: accounts are made by an admin. "Forgotten your password?" says to ask the household's admin. On iPhone, when opened in Safari rather than the installed app, a hint says to sign in inside the installed app, since the two do not share a sign-in. Also design a wrong-password error and a "Too many attempts, try again in a few minutes" state.

## 7. What must always be visible

These are product principles, not styling choices. Please do not hide them behind taps, tooltips or "more".

1. **A reason on every suggestion.** At least one reason in words on every card; the full signed list one tap away. Never a score.
2. **Suggestions look different from the plan** until the household adds them.
3. **The original text during review.** Every line on the review screen shows exactly what the recipe said, with the uncertain part highlighted, next to the app's reading. The original is never replaced by the parsed version.
4. **The dietary note** under every diet filter row and every set of diet tags: "A guide, not allergen safety."
5. **Provenance** on every recipe row and recipe view.
6. **Where a shopping amount comes from**: the source line under every shopping row.
7. **That something needs checking**: the Review marker on rows and the "N things to check" banner, without nagging (review never blocks using a recipe).
8. **Offline state** on the shopping list, with when the list was last loaded and how many ticks are waiting.
9. **Undo after every destructive or bulk action** (tick, remove from plan, bulk confirm, add all tags), as a 4 s toast in the thumb zone.

And things that must never appear: "Unknown" as a value, raw query syntax for ordinary filtering, scores or percentages, confidence numbers on the review screen beyond the one-tap answers' ordering.

## 8. Components

The design system should cover at least:

- Bottom navigation (three items) and a top bar with title, count and actions.
- Text row (recipe row) with heart and Review marker; plan item row with day chip and servings stepper; shopping row (tap target, amount, source line, badges, ticked and fading states).
- Chips: plain, removable, **tri-state** (off, include, exclude), dashed "suggested" chip, day chip, badge.
- Suggestion card (with reasons and three actions) and its "replaced in place" highlight.
- Signed reason bar (positive, negative, both themes).
- Review line in four densities: check card, glance row, clear line, done line; field chips (amount, size, ingredient, prep) including an unsure ingredient chip ("?") and a parent match ("≈ Cheese").
- Segmented choice; stepper; select; search field with typeahead list; autocomplete field.
- Bottom sheet (partial and full height) with a sticky footer button.
- Banners: info, offline (amber), synced; status banner on the review screen.
- Toast with Undo.
- Collapsible section header (In the basket, At home) and sticky aisle and day headers.
- Skeleton rows and an inline empty state.

## 9. Out of scope for these designs

- Recipe images and photography of any kind, and image slots.
- Cookbook page scanning or photo import; barcode import.
- Link packs, starter recipes, onboarding tours or marketing pages.
- Ratings and notes on recipes; a cooking mode; sharing a recipe.
- Similar recipes; "what can I make with"; natural-language or "vibe" search; saved collections.
- Presets ("Easy week"), dismissing a suggestion with a reason, leftovers, meal grouping ("a curry and its side"), hard planning rules.
- Free-text shopping items ("bin bags"); rounding to buyable packs beyond the pack hint; choosing a shop.
- Inviting other people, roles, household members or "who's eating"; live presence.
- Unit and locale preferences (UK only for now); a units setting.
- A logo or brand identity: the name is a working name, so a simple text wordmark is enough.
- Native app chrome (App Store screenshots, widgets, share extensions).

## 10. Sample content

Use this so screens read as real.

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

**Suggestion reasons** (positive): "Uses the rest of the fennel from Fennel and sausage pasta", "Shares lime and coriander with Fish tacos", "A favourite", "Not had in 7 weeks", "Quick: 25 min". (Negative, in Why this? only): "Another chicken dish", "Second pasta this week", "Cooked 10 days ago". (Fresh): "A first pick: nothing to match yet".

**Review questions** on Chicken tikka masala (BBC Good Food, 17 lines in two sections, "For the marinade" and "For the sauce"): "a thumb-sized piece of ginger" asks "How much ginger?"; "25g butter" asks "Which butter?" with Unsalted, Salted, Butter (any); "coriander, to serve" asks "Buy this, or is it optional garnish?"; "1 tbsp garam masala" is a glance line.

**Shopping list** for Chilli con carne, Tarka dal, Lemon roast chicken and Pasta e ceci: Onions "3 onions" (Chilli 1 · Dal 1 · Pasta 1); Garlic "9 cloves"; Lemons "2 lemons"; Beef mince "500 g"; Whole chicken "1.6 kg"; Chopped tomatoes "800 g · 2 tins" (Chilli 1 · Pasta 1); Red lentils "250 g"; Chickpeas "400 g · 1 tin"; Rice, no amount, "serve with" (Chilli · serve with); Parmesan "40 g + some"; Kidney beans "400 g · 1 tin"; At home: olive oil, vegetable oil, salt, black pepper, cumin, ground turmeric.

## Reference prototypes

Attach these three files when taking the brief to Claude Design. Each opens in a browser with no build step and has a variant switcher; only the chosen variant matters.

| Flow | File | Chosen variant |
|---|---|---|
| Review and correct | `docs/prototypes/recipe-review/index.html` | A (`?variant=a`): one list, two densities |
| Plan with suggestions | `docs/prototypes/plan-builder/index.html` | A: inline suggestions with Add all |
| Shopping in the shop | `docs/prototypes/shopping-list/index.html` | A: aisles, ticked items move away |

The Recipes screen, filter sheet, recipe view, import, settings and sign-in have no prototype; section 6 is their reference.
