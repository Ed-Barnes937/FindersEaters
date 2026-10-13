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
A user's override of part of the engine output. It survives re-parsing.
_Avoid_: Edit

**Personal layer**:
Household facts about a recipe (favourite, rating, notes, times cooked, user tags), held apart from the recipe itself.
_Avoid_: User data, metadata

**Provenance**:
Where a recipe came from: a book and page, a URL, or the household's own.
_Avoid_: Source

**Library**:
All the recipes a household has imported. Search narrows the library; an empty query is the whole library.
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

**Anchor**:
A plan item the household has already chosen, which suggestions are built around.
_Avoid_: Pinned recipe, seed

**Suggestion**:
A recipe the planner proposes for a plan. It always carries its reasons.
_Avoid_: Recommendation

**Reason**:
A human-readable part of a suggestion's score ("uses the rest of the coriander").
_Avoid_: Explanation

**Cadence**:
A recipe's natural gap between cookings, which makes it "due" as that gap approaches.
_Avoid_: Recency, frequency

### Shopping

**Shopping list**:
The ingredients needed for a plan, merged across recipes in canonical measures, one entry per ingredient, with tick state. It is regenerated when the plan changes and keeps its ticks by ingredient.
_Avoid_: Grocery list

**Always-have**:
An item the household always keeps, such as oil or salt. It starts ticked on every shopping list. This is the app's only knowledge of the kitchen. Unticking one on a list means the household is out of it for this shop only; it does not change the always-have list.
_Avoid_: Pantry, staples, inventory

### Onboarding

**Link pack**:
A curated, themed list of recipe links that a household can import in one tap. Recipes are fetched per household and never hosted by us.
_Avoid_: Stock library, starter recipes
