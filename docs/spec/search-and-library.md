# Search and library screens (V0.1)

Resolves [Specify the search and library screens](https://github.com/Ed-Barnes937/FindersEaters/issues/22). Feeds the V0.1 spec (`docs/spec/v0.1.md`) and [Write the Claude Design brief](https://github.com/Ed-Barnes937/FindersEaters/issues/17). Builds on `docs/spec/query-model.md` (the flat form, the URL, the field registry) and `docs/spec/tag-taxonomy.md` (dimensions, labels, the dietary note).

Every decision here is agent-decided and reversible: these are screens over a query model and data that already exist, and nothing here is persisted except a favourite and user tags, which the data model already owns. Nothing was escalated.

## Summary

- **The library and search are one screen**, Recipes (`/recipes`). An empty query is the whole library; typing or filtering narrows it. There is no separate search page.
- The screen is a **text box**, a row of **active chips** under it, a **Filters** button that opens the **filter sheet**, a **sort** control, and the **result list**.
- The filter sheet shows dimensions in the order a cook decides a meal (meal, time, protein, carb, cuisine, diet, ingredients), then the rest. A row only shows values that **at least one recipe in the library has**, plus any value the current query already uses.
- **Default sort is Recently added.** The other sorts are A to Z, Quickest and Longest since cooked. Sort lives in the URL beside `q`, never in the query.
- **Unknown is never surfaced in the sheet.** `dim:unknown` stays reachable by typing it; the review screen is where unknown gets fixed.
- **Empty and error states never guess**: an empty library offers import; no matches offers removing chips; a parse error underlines the span, shows the message (with a tappable "did you mean" fix) and shows no results.
- **A list row** is text only: title, a facts line (time, effort, cuisine), a provenance and last-cooked line, a favourite toggle and a needs-review marker.
- **The recipe view** shows provenance, favourite, facts, fixed tags (each a link back into search), the dietary guide note directly under any diet tag, user tags (add and remove inline), ingredients, method and the Add to plan action.

## Screen map

| Screen | Route | Reached from |
|---|---|---|
| Recipes (library and search) | `/recipes?q=<canonical text>&sort=<key>` | Bottom navigation (Recipes, Plan, Shopping); the start screen |
| Filter sheet | Same route, sheet open (not a route of its own) | Filters button; tapping an active chip opens the sheet at that chip's row |
| Recipe view | `/recipes/:id` | A list row; plan items; shopping list "from" links |

- Back from a recipe view restores the list's query, sort and scroll position (router scroll restoration plus the URL).
- An import entry (a + button in the Recipes header) leads to the import flows, which belong to the import capture contract and [Prototype reviewing and correcting a parsed recipe](https://github.com/Ed-Barnes937/FindersEaters/issues/14).
- **The planner reuses this screen as a picker.** Choosing anchors in [Prototype building a plan with suggestions](https://github.com/Ed-Barnes937/FindersEaters/issues/15) should open the same Recipes screen in a pick mode (rows gain an add control; tapping the row still opens the recipe). One search, one set of filters, learned once.

## The Recipes screen

Top to bottom on a phone:

1. **Header**: "Recipes", a result count ("124 recipes", or "12 of 124" when a query is active), and the import + button.
2. **Text box**: placeholder "Search recipes". Bare words search titles. Typed predicates (`time:<30`, `-ing:dairy`) are accepted as the query model defines.
3. **Typeahead**: while a bare word is being typed, a short suggestion list maps it to predicates, from the field registry's metadata:
   - "Title contains *chick*" (the default; Enter keeps it)
   - "Protein: Chicken", "Ingredient: chicken", "Ingredient: chickpeas", "Tag: chicken nights"
   Picking one replaces the word with that predicate, which then appears as a chip. This fixes the most likely surprise of title-only bare words: typing "chicken" and missing Coq au vin.
4. **Active chips**: one chip per flat-form predicate, labelled in plain English ("Italian or Thai", "Not pork", "Under 30 min", "With fennel", "Without dairy", "Favourites", "Not cooked in 2 weeks", "Title: lasagne"). Each chip has a remove control; tapping the chip body opens the sheet at its row. A "Clear" action appears when two or more chips are active. If the query is not in flat form (it has `OR` or brackets) the chip row shows the canonical text as one read-only chip with Clear, as the query model requires.
5. **Controls row**: Filters button (with a count of active predicates) and the sort control (a select showing the current sort's label).
6. **Result list**: rows as below, loaded in pages.

### Behaviour

- The client parses as you type (the parser is shared and pure) and only sends a request once the text parses, debounced at about 250 ms. Chips and syntax errors appear instantly; errors only the server can find (an unknown ingredient slug) arrive with the results.
- While a new result loads, the previous results stay on screen, dimmed, so the list does not flash empty.
- Results arrive in pages of 50 with a keyset cursor on (sort key, recipe id), loaded as the list scrolls. The response carries the total match count for the header and the sheet's button.
- Title words matched by the query are emboldened in row titles.
- The URL is rewritten (replace, not push) as the query changes, so back leaves the screen rather than stepping through every keystroke. Opening a recipe pushes.

## The filter sheet

A bottom sheet, full height on a phone, with a "Filters" header, "Clear all", and a sticky footer button "Show N recipes" (N is the live match count; "No recipes" when zero, still tappable). Results behind the sheet update live as chips change.

### Rows, in order

| # | Row | Field | Control | Values shown |
|---|---|---|---|---|
| 1 | Quick | `is:favourite`, `cooked` | Toggle chips: "Favourites", "Not cooked in 2 weeks", "Not cooked in 4 weeks" (the two cooked chips are mutually exclusive) | Fixed |
| 2 | Meal | `meal` | Tri-state chips | Values present in the library, taxonomy order |
| 3 | Time | `time` | Single-select chips: "15 min", "30 min", "45 min", "1 hour", "Any" (sets `time:<=N`) | Fixed |
| 4 | Main protein | `protein` | Tri-state chips | Present in library, taxonomy order |
| 5 | Carb | `carb` | Tri-state chips | Present in library, taxonomy order |
| 6 | Cuisine | `cuisine` | Tri-state chips, collapsed to two lines with "More" | Present in library, ordered by how many library recipes have it, then taxonomy order; `none` is not shown |
| 7 | Diet | `diet` | Tri-state chips, with the guide note under the row label | Present in library and offered by the seeded knowledge base, taxonomy order |
| 8 | Ingredients | `ing` | Two autocomplete fields, "With" and "Without", over knowledge base names and synonyms; picks show as removable chips | Any knowledge base node |
| 9 | Effort | `effort` | Tri-state chips | Easy, Medium, Hard (present in library) |
| 10 | Method | `method` | Tri-state chips, collapsed with "More" | Present in library, taxonomy order |
| 11 | Equipment | `equipment` | Tri-state chips, collapsed with "More" | Present in library, taxonomy order |
| 12 | Your tags | `tag` | Tri-state chips, collapsed with "More"; "More" reveals a filter box when there are over 20 | The household's user tags, by use count; the row is hidden when the household has none |

- **Why this order**: rows 1-5 answer "what shall we have tonight" (a favourite, a dinner, quick, chicken, with rice); 6-8 answer "what kind" and "can we eat it"; 9-12 are rarer refinements. The order is a constant in the field registry's UI metadata, so moving a row is a one-line change.
- **Tri-state chips** cycle off, include, exclude, as the query model specifies. Include is a filled chip; exclude is an outlined chip with a minus and strike-through label ("- Pork"). Within a row, included values form one any-of predicate and excluded values form one negated predicate.
- **Values present in the library**: the sheet asks the server once per opening for the library's value counts per dimension (a household-scoped aggregate, not facet counts of the current results, which stay out of V0.1). A value already in the query always shows, even with a zero count, so a shared link never hides its own filters. This keeps a 21-value cuisine row short for a library that only cooks six cuisines, and never offers a chip that cannot match.
- **Labels** are the taxonomy's display labels. Dimension rows use plain names ("Main protein", "Carb", "Diet"), not slugs.
- **The dietary note** sits directly under the Diet row label, always visible, not behind a tooltip: "A guide, not allergen safety. Check packaged ingredients like stock and soy sauce." The ingredient "Without" field is labelled so it does not read as a dietary claim ("Without: dairy" excludes recipes with a dairy line; "Dairy free" is the conservative tag).
- **Unknown** is not a chip. Asking for it is a review task, not a browsing one, and a chip labelled "Unknown" would confuse more than help. Typed `cuisine:unknown` still works and shows as a chip "Cuisine not set".
- **Ingredient autocomplete** shows the node's display name plus its parent for disambiguation ("Cream, dairy"), matches synonyms ("coriander" and "cilantro"), and ranks nodes used in the library first.

## Sort

| Key | Label | Order | Ties and unknowns |
|---|---|---|---|
| `added` (default, omitted from the URL) | Recently added | Newest import first | Then title |
| `title` | A to Z | Title, case- and accent-insensitive, ignoring a leading "The" or "A" | Then id |
| `time` | Quickest | Total time ascending | Unknown time last; then title |
| `cooked` | Longest since cooked | Last cooked ascending (longest ago first) | Never-cooked recipes after all cooked ones, newest import first; then title |

- **Why Recently added**: just after an import (the most common reason to open the library in the early weeks) the new recipe is at the top, which also confirms the import worked. A to Z is one tap away for finding a known recipe, though the text box is faster.
- **Why never-cooked sorts last under Longest since cooked**: the sort exists to resurface forgotten regulars. Putting never-cooked first would bury them under every untried import.
- Sort is a parameter of `execute`, never part of the query, as the query model requires. The selection is held in the URL only; it is not remembered per household in V0.1.

## Empty, error, loading and offline states

| State | What shows |
|---|---|
| Empty library (no recipes at all) | No text box, chips or Filters. A short message ("No recipes yet") and the import routes as buttons: paste a link, share from your phone (a how-to for the Android share target and the iPhone Shortcut), type one in. |
| No matches | The chips stay; the list area says "No recipes match these filters" with each active chip repeated as a removable button and a "Clear all" button. No guessing and no "did you mean" on zero results. |
| Parse error | The error span is underlined in the text box, the message shows under the box, and the list area shows the error instead of results. A "did you mean" suggestion is a tappable fix that rewrites just that span. The previous results are not shown, so stale results are never mistaken for the typed query. |
| Not flat form | Results show normally; the chip row and the sheet show the canonical text as read-only with Clear. |
| Too long or too many predicates (over 500 characters or 32 predicates) | A parse error at the first predicate past the limit: "Too many filters". |
| Loading (first load) | Skeleton rows. Later loads dim the previous results instead. |
| Offline or server unreachable | A banner "You're offline. Recipes need a connection." Results already loaded in this session stay visible and openable; filtering is disabled. Only the shopping list works offline in V0.1. |

## List row

```
Chicken, leek and tarragon pie                 ♥
45 min · Medium · British
BBC Good Food · Cooked 3 weeks ago        Review
```

- **Title**, up to two lines, then truncated.
- **Facts line**: total time ("45 min", "1 hr 20 min"; omitted when unknown), effort label (omitted when unknown), cuisine label (omitted when unknown or `none`). Missing facts are omitted, never shown as "unknown".
- **Provenance and history line**: provenance short form (see below) and last cooked ("Cooked today", "Cooked 3 weeks ago", "Never cooked" is omitted to keep rows quiet).
- **Favourite**: a heart toggle with a 44 px target, optimistic, reverted with a short message if the server rejects it. Favouriting needs a connection.
- **Review marker**: shown while the recipe has unreviewed engine flags. What counts as "unreviewed" is defined by [Prototype reviewing and correcting a parsed recipe](https://github.com/Ed-Barnes937/FindersEaters/issues/14); the row only needs a boolean.
- **No image** in V0.1. Rows are dense text so a 150-recipe library scans quickly, and book and own recipes have no image anyway. Showing a source image later needs the import to keep the image URL (see the asks below) and a decision on hotlinking versus storing a copy.
- Tapping anywhere except the heart opens the recipe view.

### Provenance display

| Provenance | Row (short) | Recipe view (full) |
|---|---|---|
| URL | Site name from the page if captured, else the domain without `www.` ("bbcgoodfood.com") | "From BBC Good Food" linking to the original URL (opens outside the app) |
| Book | Book title, truncated | "Book title, page 112" (page omitted when not recorded) |
| Own | "Our recipe" | "Our recipe" |

## Recipe view

Top to bottom on a phone:

1. **Header**: back, title (wraps), favourite heart, overflow menu (Review and correct, Delete).
2. **Provenance line** in full form, as above.
3. **Review banner** when the recipe has unreviewed flags: "3 things to check" linking to the review screen.
4. **Facts**: total time, servings (with the servings control the scaling work defines), effort, and last cooked ("Last cooked 12 Sept", or "Not cooked yet").
5. **Tags**: the fixed dimensions that have a value, as labelled chip groups in taxonomy order (Meal, Cuisine, Main protein, Carb, Method, Effort, Equipment, Diet). Each chip is a link to `/recipes?q=<dim>:<value>`. Dimensions with no value are omitted. An "Edit tags" link opens the review screen, which owns corrections. Diet chips are followed immediately by the dietary guide note, always visible.
6. **Your tags**: the household's user tags on this recipe as chips with a remove control, and "+ Add tag" with autocomplete from the household's existing tags (case-insensitive match, first spelling kept, as the taxonomy says). Adding or removing needs a connection.
7. **Ingredients**: lines with section headers where the engine kept them, rendered per the units display rules (map fog "Display of units") and the scaling rules (map fog "Scaling"). Lines that are not ingredients (section headers, notes) render as plain text.
8. **Method**: numbered steps.
9. **Add to plan**: a sticky primary button at the bottom, whose flow belongs to [Prototype building a plan with suggestions](https://github.com/Ed-Barnes937/FindersEaters/issues/15).

- **Delete** asks for confirmation and states what else is affected (plan items that use it); what happens to those plan items is for [Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13).
- **Not in V0.1**: rating and notes (foundation-only), similar recipes, a cooking mode or screen wake lock, sharing a recipe, editing the original text from this view (that is the review screen's job).

## What this asks of other tickets

- **[Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13)**: a recipe's created time (for Recently added); a sortable title key; provenance as one of URL (with captured site name), book (title, optional page) or own; a per-household value-count aggregate per dimension and per user tag (an indexed `GROUP BY`, no extra table needed); a cheap "has unreviewed flags" boolean per recipe; last cooked date; what deleting a recipe does to plan items.
- **[Prototype reviewing and correcting a parsed recipe](https://github.com/Ed-Barnes937/FindersEaters/issues/14)**: define "unreviewed flags", and accept "Edit tags" and the review banner as entry points.
- **[Prototype building a plan with suggestions](https://github.com/Ed-Barnes937/FindersEaters/issues/15)**: pick anchors through the Recipes screen in pick mode; Add to plan from the recipe view.
- **Import capture contract** (map fog): capture the page's site name (for provenance display) and keep the recipe image URL from JSON-LD even though V0.1 does not show it, so images can be added later without re-importing.
- **Field registry** (query module): each field's UI metadata carries its sheet row order, control kind, chip label template ("Not pork", "Under 30 min") and typeahead behaviour.
- **[Write the Claude Design brief](https://github.com/Ed-Barnes937/FindersEaters/issues/17)**: the Recipes screen, filter sheet, list row and recipe view above, with tri-state chips and the always-visible dietary note as must-shows.
