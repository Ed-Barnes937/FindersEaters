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
The structured form the engine derived from the original text: parsed lines, tags and recipe-level facts.
_Avoid_: Parse, parsed recipe

**Correction**:
A user's override of part of the engine output. It survives re-parsing.
_Avoid_: Edit

**Personal layer**:
Household facts about a recipe (favourite, rating, notes, times cooked), held apart from the recipe itself.
_Avoid_: User data, metadata

**Provenance**:
Where a recipe came from: a book and page, a URL, or the household's own.
_Avoid_: Source

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

**Food knowledge base**:
Shared reference facts about food: the ingredient hierarchy, synonyms, dietary properties and conversions. It is not owned by any household.
_Avoid_: Ingredient database, KB (in prose)

**Tag**:
A label on a recipe from a fixed dimension (cuisine, meal type, main protein, carb base, method, time, effort, dietary, equipment, season), or a free-form user tag. Every fixed tag has a written definition.
_Avoid_: Category, label

### Search and planning

**Query**:
A structured filter over recipes. Search, collections and rules are all built from it.
_Avoid_: Filter, search string

**Collection**:
A named, saved query.
_Avoid_: Folder, list, smart list

**Rule**:
A query plus a limit, applied to a plan ("at most 1 `tag:pasta`").
_Avoid_: Constraint, filter

**Plan**:
A list of recipes keyed by date, with day assignment optional. It stores servings directly.
_Avoid_: Meal plan, week, schedule

**Anchor**:
A recipe the household has already chosen for a plan, which suggestions are built around.
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
The ingredients needed for a plan, merged across recipes in canonical measures, with tick state.
_Avoid_: Grocery list

**Always-have**:
An item the household always keeps, such as oil or salt. It starts ticked on every shopping list. This is the app's only knowledge of the kitchen.
_Avoid_: Pantry, staples, inventory

### Onboarding

**Link pack**:
A curated, themed list of recipe links that a household can import in one tap. Recipes are fetched per household and never hosted by us.
_Avoid_: Stock library, starter recipes

## Flagged ambiguities

- **Plan item**: is it always one recipe, or can it be a meal of several (curry, rice and a side)? This is unresolved. Until it is, "plan item" is not a defined term.
