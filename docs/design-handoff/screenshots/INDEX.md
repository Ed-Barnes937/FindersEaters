# Screenshot index

All images are 390 x 844 at 2x. `proto` = captured from a throwaway prototype in `docs/prototypes/` (behaviour is decided, look is not); `wf` = a rough greyscale wireframe from `../wireframes/`, drawn straight from the spec (structure and content only). In prototype names, `a-chosen` is the chosen variant and `rejected` marks variants that lost, kept so you can see what was tried. Spec sections refer to `docs/spec/v0.1.md` (V0.1 section N) and the area specs it points to.

One line per image: **screen**, state: what it shows. *Spec.* Question for the designer.

## Sign in

- [01](01-wf-signin-default.png) **Sign in**, default: working-name wordmark, email, password, Sign in, "Forgotten your password?", no sign-up. *V0.1 6, 17.3; auth.md.* How plain can this be while still feeling like the same product as the rest?
- [02](02-wf-signin-iphone-safari-hint.png) **Sign in**, iPhone in Safari: hint to sign in inside the installed app; forgotten-password note expanded. *auth.md; brief 6.9.* Is a banner the right weight, or should it be the whole screen's message?
- [03](03-wf-signin-wrong-password.png) **Sign in**, wrong password: inline error under the field. *auth.md.* Error styling that is not colour-only.
- [04](04-wf-signin-too-many-attempts.png) **Sign in**, rate limited: banner, button disabled. *auth.md.* Should the fields stay editable while locked?

## Recipes (library and search)

- [05](05-wf-recipes-library.png) **Recipes**, populated library: header with count, import (+) and settings, search box, Filters and sort, text-only rows with facts, provenance, last cooked, heart and Review marker. *V0.1 11; search-and-library.md.* Row density: how many rows fit while staying readable; where the Review marker sits.
- [06](06-wf-recipes-typeahead.png) **Recipes**, typeahead while typing "chick": title words (default), protein, ingredients, user tag. *query-model.md.* How to show that picking an option makes a chip, without explaining query syntax.
- [07](07-wf-recipes-filtered-chips.png) **Recipes**, filtered: plain-English chips ("Not pork", "With fennel"), Clear, "12 of 124", Filters count. *V0.1 11.* Chip row wrapping on a phone; Clear placement.
- [08](08-wf-recipes-no-matches.png) **Recipes**, no matches: chips kept, each repeated as a remove button, Clear all, no guessing. *search-and-library.md.* Is repeating the chips as buttons clear or redundant?
- [09](09-wf-recipes-query-error.png) **Recipes**, parse error in a typed query: span underlined, message, tappable "did you mean", no results. *query-model.md.* Rare state; keep it calm.
- [10](10-wf-recipes-first-load.png) **Recipes**, first load: skeleton rows. *search-and-library.md.* Skeleton shape that matches the 3-line row.
- [11](11-wf-recipes-offline.png) **Recipes**, offline: banner, loaded rows still openable, search and filters disabled, import disabled. *brief 4.* Offline banner shared with the shopping list's amber one, or a different tone?
- [12](12-wf-recipes-empty-library.png) **Recipes**, empty library: "No recipes yet" and the three import routes, no search box. *search-and-library.md.* This is the first screen after first sign-in; how welcoming without onboarding tours?
- [13](13-wf-recipes-pick-mode.png) **Recipes**, pick mode from Plan "+ Add recipes": "Add to plan" header, Done, per-row Add / Added. *planner-screen.md.* Add control size and state change; row body still opens the recipe.
- [14](14-wf-filters-sheet-top.png) **Filter sheet**, top rows: Quick, Meal, Time, Main protein with an excluded "- Pork", Carb, Cuisine with More, live "Show 18 recipes". *V0.1 11; search-and-library.md.* The tri-state chip (off / include / exclude) is the one novel control: how does a first-time user learn the second tap excludes?
- [15](15-wf-filters-sheet-diet-ingredients.png) **Filter sheet**, lower rows: Diet with its always-visible note, With / Without ingredient autocomplete ("Cream, dairy"), Effort, Method. *search-and-library.md.* Autocomplete inside a full-height sheet with the keyboard up.

## Recipe view and scaling

- [16](16-wf-recipe-view-top.png) **Recipe view**, as written: provenance link, "3 things to check" banner, facts, servings stepper, tags as labelled groups, diet note, Edit tags, Your tags, ingredients, sticky Add to plan. *V0.1 11.* Long page: what earns space above the fold?
- [17](17-wf-recipe-view-scaled.png) **Recipe view**, scaled x1.5: factor badge, only amounts change, scaling notes under lines, metric hint "(375 g)", recipe-level "Times and tin sizes are as written". *V0.1 12, 17.1; scaling.md.* Scaling notes must be visible but quiet; how is a changed amount marked?
- [18](18-wf-recipe-view-from-plan-item.png) **Recipe view**, opened from a plan item, makes-recipe ("18 buns"): "For this plan" label, half-batch steps. *scaling.md.* Make it obvious this stepper changes the plan, not the recipe.
- [19](19-wf-recipe-view-unknown-servings.png) **Recipe view**, unknown servings: disabled stepper, "Set servings" sheet. *scaling.md.* Disabled-but-actionable pattern.
- [20](20-wf-recipe-view-overflow-delete.png) **Recipe view**, delete confirmation: says what else is affected. *V0.1 11.* Destructive styling without red-only signalling.

## Import

- [21](21-wf-import-routes-sheet.png) **Import**, routes sheet from (+): Paste a link, Type one in, a note about sharing. *brief 6.4; import-capture.md.* Should Share appear here as a how-to entry?
- [22](22-wf-import-paste-link.png) **Import**, paste a link sheet. *import-capture.md.* Auto-paste from clipboard is not specified; keep it a plain field.
- [23](23-wf-import-reading.png) **Import**, "Reading the recipe..." short wait (up to about 8 s). *V0.1 9.* Progress without a fake percentage.
- [24](24-wf-import-still-being-read.png) **Import**, partial read ("Still being read"): original lines, no actions. *V0.1 9; engine-pipeline.md.* More common now the engine calls a hosted model with a daily spend cap; must feel normal, not broken.
- [25](25-wf-import-could-not-read.png) **Import**, "Couldn't read that page": reason message (five variants listed), Type it in with the link prefilled. *import-capture.md.* One layout for five messages of different lengths.
- [26](26-wf-import-already-in-library.png) **Import**, duplicate link: Open it or Import again. *import-capture.md.* Which is primary.
- [27](27-wf-import-android-share-no-link.png) **Import**, Android share with no link. *import-capture.md.* Landing page for a share that failed.
- [28](28-wf-import-android-share-offline.png) **Import**, share while offline: link kept in the Paste a link sheet. *import-capture.md.* Retry affordance once back online.
- [29](29-wf-import-type-it-in.png) **Import**, Type one in form: title, book and page or Our recipe, serves or makes, time, ingredients one per line, method by paragraph. *V0.1 17.3.* Deliberately a paste-friendly text form, not a line builder; long textareas on a phone with the keyboard up.
- [30](30-wf-import-iphone-shortcut-notification.png) **Import**, iPhone Shortcut notification (system UI, not ours to style): wording only. *ios-shortcut.md.* Only the copy is ours; included for the flow.

## Check this recipe (review and correct)

- [31](31-proto-review-a-chosen-first-open.png) **Review**, chosen variant A, first open of a fully review-first import: status banner, facts, tags block with dashed suggested chips and an effort segmented choice, glance lines, sticky "Looks right - confirm 12". *V0.1 10; recipe-review.md.* Prototype predates the current engine modes: see 42 for the now-typical case.
- [32](32-proto-review-a-chosen-check-cards.png) **Review**, A, check cards: highlighted uncertain span, field chips (amount, ingredient, prep), question in words, one-tap answers, Edit. *recipe-review.md.* The percentages on the answers are a prototype artefact and must not appear. How do check cards stand out from the rest without alarm?
- [33](33-proto-review-a-chosen-edit-sheet.png) **Review**, A, Edit sheet: kind segmented choice, amount, unit, ingredient autocomplete, prep. *recipe-review.md.* Sheet height with the keyboard up; "Leave unresolved" escape is missing in the prototype.
- [34](34-proto-review-a-chosen-bulk-confirm-undo-toast.png) **Review**, A, after bulk confirm: undo toast in the thumb zone, footer becomes Done. *recipe-review.md.* Toast over the sticky footer: stacking order.
- [35](35-proto-review-a-chosen-all-checked.png) **Review**, A, all checked: banner turns positive, tags applied (filled), one line expanded showing "Checked". *recipe-review.md.* A calm "done" state, no celebration.
- [36](36-proto-review-a-chosen-all-checked-bottom.png) **Review**, A, all checked, bottom: done lines with ticks, "not shopped" clear line. *recipe-review.md.* Done-line density.
- [37](37-proto-review-a-chosen-partial-run-still-being-read.png) **Review**, A, partial run: "Still being read", lines as written, no actions. *engine-pipeline.md.* Same state as 24 seen from the review screen.
- [38](38-proto-review-a-chosen-dark.png) **Review**, A, dark mode. *brief 4.* Highlight and warning colours in dark.
- [39](39-proto-review-b-rejected-one-at-a-time.png) **Review**, variant B (rejected): one card at a time. Lost because it hides recipe context and invites rubber-stamping.
- [40](40-proto-review-c-rejected-two-piles.png) **Review**, variant C (rejected): two piles, questions first. Lost because it reorders the recipe.
- [41](41-proto-review-c-rejected-two-piles-scrolled.png) **Review**, variant C (rejected), scrolled to the second pile.
- [42](42-wf-review-current-modes-mostly-clear.png) **Review**, typical case under the current engine modes: most lines arrive clear (muted), a check card for a low-confidence amount, one glance line for a split question ("salt and pepper"), effort as the only tag to pick, "confirm 1". *V0.1 10; engine-pipeline.md section 4.* Design for this as the usual screen: a mostly quiet recipe with a few real questions.

## Sample-check view (new since the first brief)

- [43](43-wf-sample-check-intro.png) **Sample check**, intro: what it is, about 15 minutes, resumable. *V0.1 10; engine-pipeline.md section 4.* Entry point is not specified (Settings row, a banner on Recipes after the library import, or both?).
- [44](44-wf-sample-check-in-progress.png) **Sample check**, in progress: progress "38 of 150", each line's recipe and line number, original text over the reading, Right or Correct it, earlier answers above. *Ticket #49.* A fast, repetitive owner task: one card at a time, or a scrolling list like this?
- [45](45-wf-sample-check-correct-sheet.png) **Sample check**, correcting a line: the same Edit sheet as review. *recipe-review.md.* Reuse the review Edit sheet unchanged.
- [46](46-wf-sample-check-done.png) **Sample check**, complete: counts, no verdict or score (the verdict comes from a CLI command). *engine-pipeline.md section 4.* Whether the app should say anything about the outcome.

## Plan and suggestions

- [47](47-proto-plan-a-chosen-anchor-only.png) **Plan**, chosen variant A, one recipe in the plan before asking: plan item with day chip, servings stepper, remove; + Add recipes; suggest bar. *V0.1 13; planner-screen.md.* The prototype's "library of 24" in the header is a debug count.
- [48](48-proto-plan-a-chosen-suggestions-shown.png) **Plan**, A, suggestions shown: dashed cards with up to two reasons, Why this?, Add / Another / Swap; "Not in the plan until added". *planner-screen.md.* Proposals must look different from plan items; dashed is one answer.
- [49](49-proto-plan-a-chosen-suggestion-cards.png) **Plan**, A, suggestion cards scrolled. *suggestion-scoring.md.* Card height: four cards per request is typical.
- [50](50-proto-plan-a-chosen-add-all-footer.png) **Plan**, A, footer: Clear and "Add all 4". *planner-screen.md.* Footer competes with the bottom nav.
- [51](51-proto-plan-a-chosen-why-this-sheet.png) **Why this?** sheet: signed bars around a centre line, positive and negative reasons, no numbers. *suggestion-scoring.md.* The signed bar is a new component; it needs labels and signs, not only colour.
- [52](52-proto-plan-a-chosen-swap-sheet.png) **Swap** sheet: "Instead of Penne arrabbiata", five alternatives with reasons, Search all recipes. *planner-screen.md.*
- [53](53-proto-plan-a-chosen-another-replaced-in-place.png) **Plan**, A, after Another: the replaced card briefly highlighted. *planner-screen.md.* Distinguish "this card was replaced" from "reasons refreshed".
- [54](54-proto-plan-a-chosen-one-added.png) **Plan**, A, one suggestion added: moves into the plan, toast. *planner-screen.md.*
- [55](55-proto-plan-a-chosen-day-picker-sheet.png) **Day picker** sheet: Any day plus the next 14 days. *planner-screen.md.* Grid of day chips at thumb height.
- [56](56-proto-plan-a-chosen-grouped-by-day.png) **Plan**, A, grouped by day once an item has a day; "Any day" last. *planner-screen.md.* Day headers versus card headers.
- [57](57-proto-plan-a-chosen-filters-placeholder.png) **Plan**, A, Filters placeholder: the real thing is the Recipes filter sheet (14, 15). *planner-screen.md.* Ignore this sheet's content.
- [58](58-proto-plan-a-chosen-after-add-all-undo-toast.png) **Plan**, A, after Add all: toast "Added 3 to the plan". *planner-screen.md.* Undo after bulk add.
- [59](59-proto-plan-a-chosen-remove-undo-toast.png) **Plan**, A, remove with 4 s undo. *planner-screen.md.*
- [60](60-proto-plan-a-chosen-first-run-no-plan.png) **Plan**, A, first run: no plan yet, + Add recipes and the suggest bar only. *planner-screen.md.* An empty state that still invites the main action.
- [61](61-proto-plan-a-chosen-cold-start-suggestions.png) **Plan**, A, suggestions with no anchors (first picks). *suggestion-scoring.md.*
- [62](62-proto-plan-a-chosen-dated-plan-empty-days.png) **Plan**, A, dated plan: two items on days. *plan-lifecycle.md.* The spec also shows every empty day in a range as a thin "Nothing yet" row; the prototype only hints at it.
- [63](63-proto-plan-a-chosen-tiny-library-suggestions.png) **Plan**, A, tiny library (6 recipes). *suggestion-scoring.md.*
- [64](64-proto-plan-a-chosen-pool-running-out.png) **Plan**, A, pool running out: "Only 5 dinners left to suggest". *planner-screen.md.* Should this be a toast or an inline note in the Suggested section?
- [65](65-proto-plan-a-chosen-pool-empty.png) **Plan**, A, pool empty: "No dinners left to suggest". *planner-screen.md.* Needs a link to Recipes in the real design.
- [66](66-proto-plan-a-chosen-dark.png) **Plan**, A, dark mode. *brief 4.*
- [67](67-proto-plan-b-rejected-one-at-a-time.png) **Plan**, variant B (rejected): one suggestion at a time. Lost on speed and set-awareness.
- [68](68-proto-plan-c-rejected-day-board.png) **Plan**, variant C (rejected): a day board. Lost because it forces days on a plan that is undated by default.
- [69](69-proto-plan-c-rejected-day-board-scrolled.png) **Plan**, variant C (rejected), scrolled.
- [70](70-wf-plan-menu.png) **Plan**, header menu: New plan, Past plans. *V0.1 13.*
- [71](71-wf-plan-new-plan-sheet.png) **New plan** sheet: date chips, "Bring over 3 recipes not cooked yet" ticked by default. *plan-lifecycle.md.* Explain carry-over in one line.
- [72](72-wf-plan-finished-banner-ranged.png) **Plan**, finished-plan banner (dismissible), nudging a new plan. *plan-lifecycle.md.* A nudge, not a nag: a plan never ends on its own.
- [73](73-wf-plan-past-plans-list.png) **Past plans**, list by date range. *plan-lifecycle.md.*
- [74](74-wf-plan-past-plan-open.png) **Plan**, a past plan open: "Past plan · Go to current plan", still editable, no suggestions. *plan-lifecycle.md.* Make it unmistakable you are not on the current plan.

## Shopping

- [75](75-proto-shop-a-chosen-fresh-list.png) **Shopping**, chosen variant A, fresh list: sticky aisle headers, name, amount right-aligned, source line, whole-row tap target, progress footer. *V0.1 14; shopping-list.md.* Prototype title says "Shopping list"; the tab is "Shopping". Rows at least 60 px.
- [76](76-proto-shop-a-chosen-tick-settling.png) **Shopping**, A, row just ticked: struck through and faded in place before it moves. *shopping-list.md.* Reduced motion: instant move.
- [77](77-proto-shop-a-chosen-ticked-moved-undo-toast.png) **Shopping**, A, ticked row moved away, Undo toast. *shopping-list.md.*
- [78](78-proto-shop-a-chosen-in-basket-and-at-home-open.png) **Shopping**, A, bottom: At home (always-haves pre-ticked) and In the basket, both expanded. *shopping-list.md.* Collapsed section headers that are easy to reopen.
- [79](79-proto-shop-a-chosen-offline-ticks-queued.png) **Shopping**, A, offline: amber banner "Offline · 2 ticks saved on this phone", "List as of 10:00". *V0.1 14.* Offline must be visible but never alarming; ticking keeps working.
- [80](80-proto-shop-a-chosen-back-online-synced.png) **Shopping**, A, back online: brief "Synced". *shopping-list.md.*
- [81](81-proto-shop-a-chosen-plan-grew-was-n.png) **Shopping**, A, the plan grew: rows come back unticked with "was 9 cloves" badges. *shopping-list.md.* Badge legibility at small size.
- [82](82-proto-shop-a-chosen-partner-tick-after-refresh-basket.png) **Shopping**, A, a partner's tick (beef mince) appears after refresh, in the basket. *V0.1 17.5.* No live presence: changes appear on load or refresh.
- [83](83-proto-shop-a-chosen-all-in-basket.png) **Shopping**, A, everything ticked: "All done". *shopping-list.md.* Brief copy is "All in the basket".
- [84](84-proto-shop-a-chosen-dark.png) **Shopping**, A, dark mode. *brief 4.* Readable in a bright supermarket and a dim kitchen.
- [85](85-proto-shop-b-rejected-one-at-a-time.png) **Shopping**, variant B (rejected): one item at a time with Got it / Not now.
- [86](86-proto-shop-c-rejected-checklist-ticked-stay-put.png) **Shopping**, variant C (rejected): checklist, ticked rows stay put. Lost because the next item is no longer at the top.
- [87](87-wf-shop-nothing-to-buy.png) **Shopping**, empty: "Nothing to buy yet", link to Plan. *shopping-list.md.*
- [88](88-wf-shop-carried-over-at-home.png) **Shopping**, new plan with carried ticks: At home rows with "Bought for last plan". *plan-lifecycle.md.* Distinguish carried ticks from always-haves.
- [89](89-wf-shop-past-plan-read-only.png) **Shopping**, a past plan's list: read-only, banner. *plan-lifecycle.md.* Read-only rows must not look tappable.

## Settings

- [90](90-wf-settings-main.png) **Settings**: default servings, Always have (removable, add by autocomplete), Import from iPhone devices, Account. *V0.1 17.3.* A plain list screen; does Always have want its own page?
- [91](91-wf-settings-add-device-label.png) **Settings**, Add a device: label first. *auth.md.*
- [92](92-wf-settings-device-code-shown-once.png) **Settings**, device code shown once with Copy, Get the Shortcut and the how-to. *ios-shortcut.md section 5.* "Shown once" must be impossible to miss.
- [93](93-wf-settings-revoke-confirm.png) **Settings**, revoke a device confirmation. *auth.md.*
