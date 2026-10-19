# Recipe review screen

Resolves [Prototype reviewing and correcting a parsed recipe](https://github.com/Ed-Barnes937/FindersEaters/issues/14). Prototype: `docs/prototypes/recipe-review/index.html` (open it in a browser; `?variant=a` is the chosen layout, `b` and `c` are the rejected ones). Builds on the review contract in section 5 of `docs/spec/engine-pipeline.md` and the corrections table in section 4.4 of `docs/spec/data-model.md`.

Every decision here was made by the agent under the owner's standing rules and is reversible: it is screen layout plus one additive enum value.

## 1. The question and the answer

Under review-first stage modes nearly every ingredient line arrives flagged. The prototype imports a real 17-line, two-section recipe (chicken tikka masala from BBC Good Food) with 12 lines flagged only `review_first`, 4 lines with real questions (low confidence, an extraction disagreement, an uncertain kind), 5 tag suggestions (one below its gate) and one `info` flag.

**Clearing it takes 7 taps from cold** with the chosen layout: add tags, pick effort, one bulk confirm, one answer per real question. That is tolerable, so review-first defaults do not need revisiting before the held-out rerun.

The rejected layouts:

- **One at a time (queue)**: the same 7 taps only if the bulk shortcut is used; otherwise 17 cards of "Right, Right, Right", each with one neighbouring line as context. Invites rubber-stamping and hides the section.
- **Two piles** (needs a look above, probably right below): as fast, but reorders the recipe, so section and duplicate-ingredient questions lose their context.

## 2. Layout: one list in recipe order, two densities

Route `/recipes/:id/review`, titled "Check this recipe", back arrow to the recipe view.

1. **Status banner**: "N lines need a look, M probably right. You can leave this and come back: the recipe is already in your library." Becomes "All checked" when nothing is open. In a partial run it reads "Still being read" and the screen shows the original lines with no flags and no actions.
2. **Recipe facts**: servings, total time, unit system with its source ("UK, from bbcgoodfood.com"). A recipe-level `check` flag (`servings_unknown`, `unit_system_assumed`, `meal_type_fallback`) renders here as a card in the line-card style (below).
3. **Tags block** ("Tags we think fit"): above-gate suggestions as dashed chips with an ✕, a below-gate dimension as a segmented control of its top options with the engine's pick outlined, and one button "Add these N tags" that accepts only the above-gate chips. ✕ opens that dimension's values (the engine's alternatives first, then all values, then "Leave unset"); the choice is the correction.
4. **Ingredient lines in recipe order**, headers as section labels. Each line is one of:
   - **Check line** (has a `check` flag other than `review_first`): an expanded card with the original line, the relevant span highlighted, the engine's reading as field chips (amount, size, ingredient, prep; a dashed ingredient chip with "?" for an unconfirmed resolution suggestion, "≈ parent" for a parent match), the flag's question in words ("How much ginger?", "Which butter?", "Buy this, or is it optional garnish?"), up to three one-tap alternatives with confidence, and Edit. When the line has no open question left it shows "Looks right".
   - **Glance line** (only `review_first` flags): one compact row, original text over a short reading ("4 Chicken breast?"), and a round tick button. Tapping the text expands it into a card.
   - **Clear line** (no `check` flag, including not-an-ingredient lines): muted original text, "not shopped" for not-an-ingredient. Tapping expands it into a card with Edit, so any line can be corrected, flagged or not.
   - **Done line**: muted text with a small tick; tap to expand and edit.
5. **`info` flags** show as a one-line note inside the card ("No weight for a piece of ginger: kept as written on the shopping list"). They never make a line a check line.
6. **Sticky footer**: "Confirm N" while glance lines are open; "Done" (back to the recipe view) after.

## 3. Behaviour

- **Answering the last open question on a line confirms the rest of that line.** Picking an alternative stores that field's correction, then confirms the line's remaining `review_first` fields, so a check line costs one tap when an alternative is right.
- **The bulk action covers glance lines only.** It never confirms a check line, a below-gate tag or a recipe-level flag. One recipe-wide button, not one per section: recipes are 10 to 25 lines, and per-section buttons add taps without adding scrutiny.
- **Undo**: bulk confirm and "Add these N tags" show a 4 s toast with Undo (the same pattern as the shopping list).
- **Edit sheet** (bottom sheet): kind (Shop for it / No amount / Not shopped), amount, unit (from the unit lexicon), ingredient by autocomplete over knowledge base names and synonyms, prep. Save stores a `change` correction per changed field and confirms the rest of the line. Free text that matches no ingredient is not accepted (no household-created ingredients, per the knowledge base spec); "Leave unresolved" is the escape.
- **After any correction** the server reruns the deterministic stages (engine pipeline section 6) and the screen re-renders from the new output. A correction can raise a new flag (an ingredient change can produce `unit_mismatch`), which appears in place.
- **Orphaned corrections** render as a check card: "You changed this to X before; this line now reads differently", with "Use X again" (re-points the correction to the current anchor) and "Drop it" (deletes it), as the data model spec says.
- **Review needs a connection** (as favouriting does): offline, the screen shows the lines read-only with a note. The offline queue stays the shopping list's alone.
- **Entry points**: straight after an import (a review-first import nearly always has open flags; with none it goes to the recipe view), the recipe view's "N things to check" banner, its overflow "Review and correct", and "Edit tags" (which scrolls to the tags block).
- **Needs review** (the library marker): at least one `check` flag whose target has no correction, as the engine pipeline and data model specs already say. Tag suggestions are `check` severity: under review-first every tag stays unknown until confirmed, and an untagged library would starve search and the planner's variety terms.

## 4. Data model hand-off

- **Correction intent gains `confirm_bulk`** alongside `change` and `confirm`. A bulk confirmation pins the engine's value like any confirmation, but is **not** a golden-set candidate: only an individual `confirm` (a tick on one line, or picking the engine's own top alternative) is. An additive enum value.
- A confirmation of an extraction flag stores one correction per extracted field (`quantity`, `unit`, `ingredient`, `prep`), each with the engine's value; a structural confirmation stores `split` (and `role` where that was flagged).
- A tag confirmation is `tag:<dimension>:<value>` with `add`; "Leave unset" after ✕ stores `remove` for the suggested value.
