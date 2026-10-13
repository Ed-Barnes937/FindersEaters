# The Plan screen: building a plan with suggestions (V0.1)

Resolves [Prototype building a plan with suggestions](https://github.com/Ed-Barnes937/FindersEaters/issues/15). Builds on `docs/spec/suggestion-scoring.md`, `docs/spec/search-and-library.md` and `docs/spec/data-model.md`. Feeds [Write the Claude Design brief](https://github.com/Ed-Barnes937/FindersEaters/issues/17) and [Assemble the V0.1 spec](https://github.com/Ed-Barnes937/FindersEaters/issues/18).

Prototype: `docs/prototypes/plan-builder/index.html` (open it in a browser; also published privately at https://claude.ai/artifact/Rgq7FKSUHX6bzNEMkKX3FL). It runs the real scoring and selection design over a 24-recipe example library, with three variants and four scenarios.

Every decision here is agent-decided and reversible: it is screen behaviour over data that already exists (plans, plan items, the stateless `suggest` call). Nothing was escalated.

## Summary

- **One Plan screen** for the current plan. Plan items on top, suggestions inline underneath as visibly different (dashed) cards. Nothing is in the plan until it is added.
- **Anchors** come from the Recipes screen in pick mode, or from Add to plan on a recipe view.
- **Suggest bar**: meal type, "how many more", and the Recipes filter sheet. One group per request.
- **Card**: title, time and effort, at most two positive reasons, "Why this?", then **Add**, **Another** (skip) and **Swap**.
- **Add all** in the footer while suggestions are showing.
- **Day and servings belong to plan items only.** A day chip opens a day picker; undated is the default and is fine.
- **Reasons are always computed against what is on screen now**, not against the set at pick time (a small change to the scoring spec, section 3 below).

## 1. Variants tried and the verdict

| Variant | Shape | Verdict |
|---|---|---|
| A. Inline in the plan | Plan items, then a suggest bar, then all suggestions as cards, footer "Add all" | **Chosen.** Everything is visible at once, so set-aware reasons that point at another suggestion ("Uses the rest of the lime from Fish tacos") point at something the household can see. One-tap accept-all for the common "these look fine" case. |
| B. One at a time | A full-screen card with every reason, Skip / Add to plan | Rejected. Decisive and roomy for reasons, but hides the set: a reason may cite a suggestion not yet shown, there is no accept-all, and it turns a glance into N decisions. |
| C. Day board | Seven day rows; "Fill N empty days" puts a suggestion on each empty day | Rejected as the primary shape. It forces dates on every suggestion, which contradicts optional dates and makes the count a function of the calendar. Its one good idea (seeing empty days) is kept for plans that have a date range (section 5). |

## 2. The screen, top to bottom

1. **Header**: "Plan", with the plan's range if it has one ("13-19 Oct") and a count ("5 recipes · 3 on a day"). A menu holds New plan and past plans.
2. **In the plan**: plan items. Grouped by day once any item is dated (date headers in order, then "Any day"); a flat list otherwise. Each row: title, time and effort, a **day chip** ("Any day" or "Wed 14 Oct"), a **servings stepper**, and remove (with a 4 s undo toast, as on the shopping list).
3. **+ Add recipes**: opens the Recipes screen in pick mode (rows gain an add control; tapping a row still opens the recipe). Added recipes are anchors.
4. **Suggest bar**: "Suggest [-] N [+] more [dinners v]", a quick "Under 30 min" chip, a Filters button that opens the same filter sheet as Recipes (Meal preset to the chosen type), and the Suggest button.
5. **Suggested** (only while there are pending suggestions), subtitled "Not in the plan until added": the cards.
6. **Footer** (only while there are pending suggestions): Clear and "Add all N".

## 3. Suggestion cards and reasons

- **Card content**: title; time and effort line (plus "Favourite"); up to two positive reasons with contribution at least 0.1, largest first; else the fresh reason; a "Why this?" link; actions Add (primary), Another, Swap.
- **Compact overlap copy on the card**: name only the most distinctive shared ingredient ("Uses the rest of the fennel from Fennel and sausage pasta"), or two when both come from the same recipe ("Shares fennel and crème fraîche with ..."). Two ingredients from two recipes made a sentence too long for a phone card in the prototype. "Why this?" shows the full reason.
- **Why this?** is a bottom sheet listing every reason, penalties included, each as a signed bar (green pulls up, red pushes down) around a centre line. **No numbers** in the UI. When nothing pulled or pushed, it says so in words.
- **Reasons describe the current set.** The prototype showed that reasons fixed at pick time go stale: skip the recipe a card's reason cites, and the card lies. So every card's reasons are recomputed (with `explain(recipe, set)`) against the plan items plus all other pending suggestions whenever any of them changes. This also makes reasons symmetric (both lime dishes say so). **Which recipe sits in each slot never changes except by that slot's own skip or swap**, so the screen stays stable.
  - Change to `docs/spec/suggestion-scoring.md` for the assembler: selection is unchanged, but `suggest` returns each pick's reasons computed against the final set (plan plus all other picks), and the API also exposes `explain(request, recipeIds)` (or returns fresh reasons for every pending suggestion on each skip and swap response), so the client never renders stale reasons. The sum-of-contributions property still holds for that set.
- **Empty pool**: when the pool gives fewer than asked, a toast and an inline note say "Only 3 dinners left to suggest" (or "No dinners left to suggest", with a link to Recipes to loosen filters or import).

## 4. Actions

| Action | Behaviour |
|---|---|
| **Add** | The suggestion becomes a plan item (an anchor) with default servings (below), no date, appended in position. Toast with Undo. Other cards keep their recipe; their reasons refresh. |
| **Add all** | Every pending suggestion becomes a plan item, in card order. Toast "Added 4 to the plan". |
| **Another** (skip) | The recipe joins `skipped`; exactly that slot is re-picked with everything else held fixed; the new card replaces the old one in place with a brief highlight. If the pool is empty, the card goes and a toast says "No more to suggest for that slot". Skips last for the planning session only. |
| **Swap** | A sheet "Instead of X" lists the next five candidates for that slot (score against plan plus the other pending suggestions), each with its compact reasons, and a "Search all recipes" row that opens Recipes in pick mode. Choosing one **adds it straight to the plan** (a deliberate choice is an acceptance) and skips X. Needs `suggest` to return the top k for a replaced slot (`alternatives: 5`), a request parameter, not a new concept. |
| **Clear** | Drops pending suggestions without skipping them (asking again brings the same ones back, since selection is deterministic). |
| **Suggest** again | Adds N more pending suggestions against the current plan plus the pending ones. Pending ones are not reshuffled. |
| **Remove** a plan item | Removes it, with undo. Pending suggestions keep their recipe; their reasons refresh. |

**Planning session**: `pending` and `skipped` live in client memory for the Plan screen, as the scoring spec says. Leaving the screen and coming back keeps them for the life of the tab; a reload loses them. Re-asking is cheap and deterministic, so nothing more is needed in V0.1.

## 5. Count, meal type, days and servings

- **Meal type**: a select of the meal values present in the library, defaulting to Dinners. One group per request. Sides are asked for the same way ("Suggest 2 more sides"), per [Decide whether a plan item is one recipe or a meal](https://github.com/Ed-Barnes937/FindersEaters/issues/3).
- **Count is "how many more"**, not a target total, because a plan mixes meal types and a total would need to know which items count. Default: (the number of days in the plan's range, or 5) minus the plan items whose recipes match the chosen meal type, at least 1. Stepper 1 to 14.
- **Day assignment is optional and lives on plan items only**, never on suggestions. The day chip opens a sheet: "Any day" plus a grid of the plan's range, or the next 14 days from today when the plan has no range. Any number of items can share a day. Dating an item moves it under its day header.
- **With a date range**, the "In the plan" list shows every day in the range as a header, empty ones as a thin "Nothing yet" row, then Any day. This keeps variant C's view of empty days without forcing dates onto suggestions.
- **Servings** default to the household's default servings for a `serves` recipe with known servings, else null ("as written"), per `docs/spec/data-model.md`. The stepper shows "As written" for null and the recipe's yield kind otherwise ("4 servings", "12 buns").
- **Reference date** for recently cooked: the plan's earliest dated item, else the range start, else today. (The scoring spec says earliest date or today; adding the range start is a small refinement.)

## 6. Starting a new plan

- **New plan** (header menu) opens a sheet: dates as chips ("This week" Mon-Sun, "Next 7 days", "Pick dates", "No dates"), and, when the current plan has undated items, "Bring over N recipes without a day" ticked by default. Bringing them over moves them (they leave the old plan), so an unplanned recipe is never in two plans at once.
- The new plan becomes current (it is the most recently created), per the data model. Dated items in the old plan stay as history.
- No plan yet (first run): the Plan screen shows the suggest bar and "+ Add recipes" over an empty plan; the first add or suggestion creates the plan with no range.

## 7. Cold start and edge cases seen in the prototype

- **No anchors**: the first card says "A first pick: nothing to match yet" only when nothing positive applies; once two suggestions are on screen they usually explain each other, which reads well.
- **Tiny library**: the pool runs out quickly and the note says so. Fine.
- **Overlap saturates in a small library.** With 24 recipes, most ingredients are rare, so two shared ingredients hit the 1.5 cap and most cards score overlap at the full 1.0; favourites and penalties then decide. This is a tuning question for the planner fixture tests, not a screen question (see the new fog below).

## 8. Out of V0.1 (unchanged)

Presets, dismiss with a reason, dated suggestions (weekday vs weekend), drag to reorder (position is set by add order and by date; manual reordering can come later), and suggestions on the recipe view ("goes well with").
