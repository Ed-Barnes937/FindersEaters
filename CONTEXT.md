# Finders Eaters

A recipe book that understands its recipes: it reads imported recipes into a consistent structured form, then uses that to make the collection searchable and to suggest weekly plans and shopping lists. Background and rationale live in [docs/ideation/README.md](docs/ideation/README.md).

## Language

### Ownership

**Household**:
The owner of a library, its plans and its always-have list. One or more users act on its behalf.
_Avoid_: Account, family, team

**User**:
A person who signs in and acts for a household.
_Avoid_: Member (reserved for a future concept: a person who eats, who may not have an account)

**Import token**:
A secret that lets one device (such as the iPhone Shortcut) add recipes to a household's library from outside the app. It belongs to the household, is made by a user and can only import: it cannot read the library or sign in.
_Avoid_: API key

### Recipes

**Recipe**:
A dish as imported into a household's library, made of its original text, the engine output and any user corrections.
_Avoid_: Dish, meal

**Original text**:
The recipe exactly as the user supplied it, kept forever so it can be re-parsed.
_Avoid_: Raw recipe, source

**Engine output**:
The structured form the engine derived from the original text: parsed lines, tags and recipe-level facts such as total time (time is a fact, not a tag).
_Avoid_: Parse, parsed recipe

**Correction**:
A user's decision about part of the engine output: a changed value, or a confirmation that the engine's value is right. It is an input to the engine, so it survives re-parsing and holds that part fixed against later engine changes.
_Avoid_: Edit, override

**Personal layer**:
Household facts about a recipe (favourite, rating, notes, user tags), held apart from the recipe itself. Times cooked and last cooked are not stored there: they come from cookings.
_Avoid_: User data, metadata

**Provenance**:
Where a recipe came from: a book and page, a URL, or the household's own.
_Avoid_: Source

**Capture**:
What a device or the server collected when a recipe was imported: a link with the page as it was seen, or the fields a person typed in. The original text is extracted from it. It is kept as evidence and never replaces the original text.
_Avoid_: Scrape, raw import

**Capture route**:
One of the ways a recipe enters the library: paste a link, share from an Android phone, the iPhone Shortcut, or type it in. Every route ends in the same import.
_Avoid_: Import method, channel

**Library**:
All the recipes a household has imported and not deleted. Search narrows the library; an empty query is the whole library. A deleted recipe leaves the library but stays in the plans it was part of.
_Avoid_: Collection (a named saved query), cookbook, recipe box

### The engine

**Engine**:
The pipeline that turns original text into engine output.
_Avoid_: Parser

**Line kind**:
The classification of an ingredient line, using the test "would you buy it or get it out?". It is one of *quantified*, *unquantified* or *not an ingredient*.
_Avoid_: Line type

**Canonical measure**:
The natural measure an ingredient is stored and reasoned in (count for onions, ml for milk, grams for flour), plus rough conversions between its forms.
_Avoid_: Base unit, standard unit

**Pack size**:
The amount an ingredient is sold in, such as a 400g tin or a 30g pack of coriander. It is separate from the canonical measure: a line counted in packs ("1 tin chopped tomatoes") converts through the pack size, not through a portion weight or density.
_Avoid_: Can weight, tin size

**Food knowledge base**:
Shared reference facts about food: the ingredient hierarchy, synonyms, dietary properties, conversions, typical pack sizes and aisles. It is curated by us and is not owned or edited by any household.
_Avoid_: Ingredient database, KB (in prose)

**Ingredient**:
An entry in the food knowledge base that ingredient lines resolve to. It has names, a place in the ingredient hierarchy, dietary properties and a canonical measure.
_Avoid_: Food, item, product

**Ingredient hierarchy**:
The "is a" tree of ingredients (cheddar is a cheese). Ingredient searches follow it. An ingredient may also be *made from* another (chicken stock from chicken). Dietary properties follow both relations, but the hierarchy follows "is a" only.
_Avoid_: Taxonomy, category tree

**Open data layer**:
The facts in the food knowledge base that come from Open Food Facts. They are kept separable so they can be shared under that licence.
_Avoid_: OFF layer, base layer

**Own layer**:
The facts in the food knowledge base that we author ourselves: UK names, fixes, measures, dietary properties the open sources lack, pack sizes and aisles. It wins over every other source.
_Avoid_: Custom layer, overrides

**Resolution**:
Matching an ingredient line to an ingredient. A line resolves exactly, to a parent (a broader ingredient that clearly applies), or not at all (an unresolved line).
_Avoid_: Matching, linking

**Golden set**:
Hand-labelled recipe lines and recipes with the answer the engine should give for each stage. It is the engine's regression suite.
_Avoid_: Test data, fixtures

**Held-out set**:
The part of the golden set that nothing is tuned on. Engine accuracy is reported against it only. The rest of the golden set, which framing and thresholds may be tuned on, is the dev set.
_Avoid_: Test split, validation set

**Tag**:
A label on a recipe: either a value from a fixed dimension, or a user tag. Every fixed value has a written definition.
_Avoid_: Category, label

**Dimension**:
One fixed axis of tags with a closed set of values: meal type, cuisine, main protein, carb base, method, effort, equipment or dietary. Each is either single- or multi-valued.
_Avoid_: Facet, tag type

**Derived tag**:
A tag computed from a recipe's ingredients and the food knowledge base rather than judged by the engine. Dietary tags are derived. It is corrected by correcting the ingredients, never directly.
_Avoid_: Inferred tag

**User tag**:
A free-form label a household puts on a recipe. It is a household fact, kept in the personal layer, and the app never interprets it.
_Avoid_: Custom tag, label

**Flag**:
A note the engine attaches to part of its output that it is unsure of or found inconsistent, asking the household to check it. A recipe needs review while it has a flag whose part has no correction.
_Avoid_: Warning, error, issue

**Scale factor**:
How many times the recipe as written a plan item or recipe view uses: the chosen servings divided by the recipe's servings (or by its yield count for a "makes" recipe). As written, or with unknown servings, it is 1.
_Avoid_: Multiplier

**Scaling note**:
A short instruction shown on a scaled ingredient line that does not scale cleanly ("Rounded from 1½", "Part tin - keep the rest", "start with less and add to taste"), plus one recipe-level note that times and tin sizes are as written. Unlike a flag, it depends on the scale factor, asks nothing of the household and never makes a recipe need review.
_Avoid_: Scaling flag, warning

**Use amount**:
The single amount of a scaled line that a cook will actually use and the shopping list buys: the top of a range, a whole count for things that only come whole, and the combined value of an arithmetic quantity.

**Check line**:
A parsed line with a flag other than review-first, shown expanded on the review screen with a question to answer.
_Avoid_: Problem line, error line

**Glance line**:
A parsed line whose only flags are review-first, shown as a compact row and confirmable in bulk.
_Avoid_: Low-priority line

**Bulk confirmation**:
Confirming all glance lines of a recipe at once. It pins the engine's answers like any confirmation, but they do not become golden-set candidates.
_Avoid_: Confirm all, accept all

**Re-parse**:
Running the engine again over a recipe's original text, with its corrections held fixed. It happens when the engine changes. A food knowledge base change only re-runs resolution and what follows it.
_Avoid_: Reprocess, refresh

**Unit system**:
The measuring convention a recipe was written in (UK, US or Australian), which fixes what a cup, a tablespoon and a pint mean. It belongs to the recipe, not to a line.
_Avoid_: Locale, region

**Optional line**:
An ingredient line the recipe marks as optional. It still counts towards dietary tags.
_Avoid_: Garnish

**Metric hint**:
A muted metric equivalent shown after an amount written in cups, ounces, pounds, fluid ounces, pints or Australian tablespoons. It never replaces the original or scaled text.

**Jev spend cap**:
The daily app-wide limit on Jev requests. Past it, recipes are still saved and read partly, then finished later.

### Search and planning

**Query**:
A structured filter over recipes: predicates combined with and, or and not. Search, collections and rules are all built from it. It selects recipes; it never ranks or sorts them.
_Avoid_: Filter, search string

**Predicate**:
One condition in a query, testing a single field of a recipe (`cuisine:italian`, `ing:fennel`, `time:<30`). It is true only when the recipe's known facts satisfy it, so an unknown value never matches.
_Avoid_: Clause, term, chip (a chip is the UI's rendering of a predicate)

**Collection**:
A named, saved query.
_Avoid_: Folder, list, smart list

**Rule**:
A query plus a limit (at least or at most N matching plan items), applied to a plan ("at most 1 `carb:pasta`").
_Avoid_: Constraint, filter

**Plan**:
A list of plan items, each optionally on a date. A date can hold any number of plan items.
_Avoid_: Meal plan, week, schedule

**Plan item**:
One entry in a plan. For now it is always a single recipe with its own servings, optionally on a date.
_Avoid_: Meal, slot

"Meal" is not a domain term: what is eaten together is the plan items that share a date.

**Cooking**:
A dated plan item, counted as the recipe being cooked on that date, whether the date is past or future. A recipe's last cooked date is its latest cooking on or before today; an undated plan item is never a cooking.
_Avoid_: Cook event, history entry

**Current plan**:
The household's most recently created plan, which the Plan and Shop screens open by default; older plans stay as history. Starting a new plan can bring over the old plan's items that are not cooked yet (undated, or dated today or later).
_Avoid_: Active plan, this week

**Finished plan**:
A plan whose date range has ended, or, with no range, one that has dated items and none dated today or later. The household is nudged to start a new plan, but a plan never ends on its own.
_Avoid_: Expired plan, closed plan

**Anchor**:
A plan item the household has already chosen, which suggestions are built around.
_Avoid_: Pinned recipe, seed

**Suggestion**:
A recipe the planner proposes for a plan. It always carries its reasons. It is not part of the plan until the household accepts it, which makes it a plan item (and so an anchor).
_Avoid_: Recommendation

**Reason**:
A human-readable part of a suggestion's score ("uses the rest of the coriander"). Every reason is one term of the score, positive or negative, and the reasons add up to the score. A suggestion's reasons always describe the plan as it is now (plan items plus the other suggestions on screen), so they change when the plan changes.
_Avoid_: Explanation

**Cadence**:
A recipe's natural gap between cookings, which makes it "due" as that gap approaches. Until cadence is learned, every recipe shares one default gap.
_Avoid_: Recency, frequency

**Candidate pool**:
The recipes a suggestion request may draw from: those matching the request's query, not already in the plan and not skipped. Hard rules narrow it; soft signals only rank it.
_Avoid_: Candidates list, eligible recipes

**Overlap**:
The ingredients a suggestion shares with the rest of the plan, each weighted by its distinctiveness. Always-have ingredients never count.
_Avoid_: Shared ingredients score, reuse

**Distinctiveness**:
How rare an ingredient is in the household's own library. Shared fennel is distinctive; shared salt is not.
_Avoid_: Rarity, weight

**Variety**:
How different a suggestion is from the rest of the plan in main protein, carb base, cuisine and method. Each repeat costs more than the last.
_Avoid_: Diversity, similarity score

**Skip**:
Turning down a suggestion for this planning session only, which replaces it in place with the next best. It is not remembered.
_Avoid_: Dismiss (reserved for the later dismiss with a reason), reject

**Swap**:
Replacing a suggestion with a recipe the household chooses, from the next best for that place or from search. The chosen recipe goes straight into the plan, and the replaced suggestion counts as skipped.
_Avoid_: Replace, substitute

### Shopping

**Shopping list**:
The shopping items needed for every plan item in a plan, whatever the item's date, merged across its recipes, one per ingredient. Each plan has its own list, so a new plan starts with fresh ticks. It always reflects the plan as it is now; only its ticks are kept, by item.
_Avoid_: Grocery list

**Shopping item**:
One entry on a shopping list: an ingredient (or the exact wording of an unresolved line) with its merged amount, the recipes it comes from and its tick.
_Avoid_: Row, line (a line is an ingredient line in a recipe)

**Tick**:
Marking a shopping item as got. It remembers the amount the shopper saw, so if the plan later needs more, the item is unticked again. When a new plan brings over recipes not cooked yet, their ticks come with them and show as At home.
_Avoid_: Check, done

**Aisle**:
One of a fixed set of shop sections in a fixed walk order. Every ingredient gets one from the food knowledge base, inherited down the ingredient hierarchy.
_Avoid_: Category, department

**Serve-with item**:
A carb the shopping list adds because a recipe is served with it (from its carb base) but none of its lines are for it. It has no amount.
_Avoid_: Side, accompaniment

**Always-have**:
An item the household always keeps, such as oil or salt. It starts ticked on every shopping list. This is the app's only knowledge of the kitchen. Unticking one on a list means the household is out of it for this shop only; it does not change the always-have list. It covers the same ingredient, any more specific kind of it, and any more general request it satisfies (olive oil covers extra virgin olive oil and a recipe's generic oil), but not sibling kinds.
_Avoid_: Pantry, staples, inventory

### Onboarding

**Link pack**:
A curated, themed list of recipe links that a household can import in one tap. Recipes are fetched per household and never hosted by us.
_Avoid_: Stock library, starter recipes
