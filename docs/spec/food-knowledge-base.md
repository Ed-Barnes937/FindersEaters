# Food knowledge base: seeding and maintenance

Decided in [Decide how the food knowledge base is seeded](https://github.com/Ed-Barnes937/FindersEaters/issues/9). Inputs: [Check seed-source coverage of golden set ingredients](https://github.com/Ed-Barnes937/FindersEaters/issues/8) (`docs/research/seed-coverage.md`) and the source survey in `docs/ideation/research/open-food-data.md`.

Every decision here is agent-decided and reversible unless marked otherwise. None is a one-way door: the knowledge base is rebuilt from pinned sources plus our own files, so any rule below can change and be rebuilt.

## 1. Shape in one paragraph

The food knowledge base is a **build artifact**. It is rebuilt from pinned copies of three open sources plus the **own layer**, a set of reviewed data files kept in the product repo. The build writes it into Postgres (a `kb` schema) server side. Households never edit it. The owner curates it, with agent help, through pull requests. Recipes point at **ingredients** by a stable internal id. When the knowledge base changes, affected recipes are re-resolved through the same lazy and batch staleness mechanism that the stack ADR already uses for re-parsing.

## 2. Sources and the slices imported

| Source | Licence | Slice imported | Pinned how | Used for |
|---|---|---|---|---|
| Open Food Facts ingredients taxonomy (`ingredients.txt`) | ODbL 1.0 | Every entry with an English name (about 4,800): id, English names and synonyms, parent links, `vegan` and `vegetarian` properties, allergen properties (as hints only), Wikidata and CIQUAL ids | A git commit of the openfoodfacts-server repo plus a checksum | Ingredient identity, names, hierarchy, vegan and vegetarian flags |
| Intake24 UK food database (legacy `foods.xml`) | OGL v3.0 | Standard-portion **item weights only** (medium onion 150g, garlic clove, egg sizes, fillets), for Intake24 foods linked to an ingredient | The archived repo's final commit plus a checksum | UK item weights |
| USDA FoodData Central SR Legacy (2018-04 CSV) | CC0 | `food_portion` rows for linked foods: item weights and level cup, tablespoon and teaspoon weights, from which a density follows | The final release zip plus a checksum | Densities, fallback item weights |

Not imported in V0.1:

- **Intake24 spoon weights.** They are serving estimates (cornflour 30g a teaspoon), never densities.
- **Open Food Facts products** (pack sizes by statistics). Typical pack sizes come from the own layer instead. Derivation from products is a later improvement.
- **The Open Food Facts additives taxonomy.** The one cooking item it holds (bicarbonate of soda) becomes an own-layer ingredient.
- **Wikidata en-gb labels, CoFID, FoodOn.** The Wikidata id is kept on each ingredient so a label pull can be added later. UK names come from the own layer in V0.1.

The whole Open Food Facts English taxonomy goes in, not a filtered cooking subset. It is small, a filter would be a judgement call with no data behind it, and an obscure entry that is never resolved costs nothing. The roughly 1,000 "cooking ingredients" in the coverage estimate is a planning figure, not a boundary in the data.

## 3. Layers, precedence and the ODbL boundary

Every fact in the knowledge base (a name, a parent link, a property, a conversion, a pack size, an aisle) carries its **source**: `off`, `intake24`, `usda` or `own`. The build computes one effective value per fact by precedence and keeps the losing candidates for audit.

| Fact | Precedence (first wins) |
|---|---|
| Names and synonyms used for resolution | own (en-gb first) > off |
| Display name | own > first OFF English name |
| Parent links | own (adds, removes or reclassifies an edge) > off |
| Dietary properties | own > off (vegan and vegetarian only; OFF allergens are hints for curation, never used directly) |
| Item weights | own > intake24 > usda |
| Density | own > usda |
| Canonical measure, pack sizes, aisle | own only (derived proposals are written into the own layer, see section 5) |

**The open data layer** is everything sourced `off`. Keeping source on every fact means the build can always emit the OFF-derived data, including our changes to OFF facts, as a separate dump. The **own layer** refers to OFF entries only by id, so it is stored and versioned apart from them.

ODbL handling in V0.1:

- The knowledge base stays server side. Clients get answers (autocomplete, an aisle per shopping row), never the database. This keeps the question of "public use" of a derived database as small as possible.
- The app's about screen carries attribution for Open Food Facts (ODbL), Intake24 (OGL v3.0) and USDA FoodData Central (citation).
- Nothing is published in V0.1. Whether the own layer must also be offered under ODbL once the merged base is used publicly is a pre-V1 question (see "Fog" in the resolution). The layering keeps both answers open. Publishing under ODbL is the irreversible step, and it is not taken here.

## 4. Ingredient identity

- Each **ingredient** has an internal surrogate id. Recipe lines, corrections and always-have items reference that id, never an OFF id.
- Each ingredient also has a unique, human-readable **slug**, which the query model needs (`ing:dairy`). For OFF entries it is the OFF id without `en:`. Own-layer ingredients choose theirs (`plain-flour`). When a slug changes, the old one is kept as an alias, so saved queries keep working.
- Ingredients are **never deleted** while anything references them. When an upstream entry disappears or two entries merge, the ingredient is **retired** with a `replaced_by` pointer, and re-resolution and corrections follow the pointer.
- The OFF id is a column on the ingredient, used to match rows when OFF is re-imported.

## 5. Hierarchy and dietary properties

**Two relations, not one.** OFF parents mix "is a" (cheddar is a cheese) with "made from" (chicken broth sits under chicken). So every imported parent edge is classified:

- **is a** edges form the **ingredient hierarchy**. `ing:` queries, protein gating, aisle inheritance and the ancestor closure follow only these. `ing:chicken` must not match a recipe that only uses chicken stock.
- **made from** edges are followed only by dietary derivation, so chicken stock stays non-vegetarian without hand-setting it.

The classification is a rule plus own-layer overrides: an edge is "is a" by default, and the build flags candidates for "made from" (the child's name contains broth, stock, sauce, paste, extract, oil of, flavouring, juice or powder of the parent's name, or the child sits in a different food group). An agent reviews the flagged list, and the result is recorded as own-layer edge reclassifications.

**Own-layer children inside the OFF tree.** UK flour types (plain, self-raising, strong, cake) go under wheat flour. Ground and whole forms go under each spice. Missing entries (chilli flakes, oyster sauce, choy sum, saffron, bicarbonate of soda, beef cuts, UK prepared products such as stock cubes, naan and curry pastes) are own-layer ingredients with an OFF parent where one fits.

**Dietary properties** are tri-state (yes, no, unknown) and are limited in V0.1 to what the seven `diet` values need:

| Property | Feeds |
|---|---|
| contains meat or poultry | vegetarian, pescatarian, vegan |
| contains fish or shellfish | vegetarian, vegan |
| contains other animal product (dairy, egg, honey, gelatine, animal rennet) | vegan, vegetarian (gelatine and rennet) |
| contains gluten | gluten_free |
| contains milk | dairy_free |
| contains egg | egg_free |
| contains tree nuts or peanuts | nut_free |

- Properties are set on high branches in the own layer (vegetables: no meat, no gluten, no milk) and inherited down "is a" and "made from" edges. A "yes" anywhere up either chain wins over an inherited "no". A nearer explicit value wins over an inherited one.
- OFF `vegan` and `vegetarian` seed the first three where the own layer is silent. Known wrong values (Worcestershire sauce) are own-layer overrides. OFF "maybe" maps to unknown.
- Brand-variable items (stock cubes, soy sauce, Worcestershire) are set explicitly, conservatively, and stay "a guide, not allergen safety", as the tag taxonomy requires.
- The full UK 14 allergens are not in V0.1. They are more properties of the same shape, so adding them later is additive.
- Every `diet` value in the tag taxonomy is backed by a property above, so none is hidden in V0.1.

**Protein branches.** The own layer maps each `protein` tag value to one or more hierarchy nodes (`chicken` to the poultry/chicken branch, and so on), which protein gating uses.

**Aisles** are an own-layer property, set on high "is a" branches and inherited, with overrides where a child shops elsewhere (chicken stock is in the cupboard aisle, not meat). The aisle values and walk order belong to [Define shopping list merge and regeneration rules](https://github.com/Ed-Barnes937/FindersEaters/issues/23).

## 6. Canonical measures and conversions

Each ingredient has a **canonical measure**: a dimension (count, volume in ml, or mass in g), plus for count a default item name and size ("medium" onion, "clove" of garlic, "fillet" of salmon).

**Conversions** per ingredient are:

- **item weights**: named sizes or units to grams (small 60g, medium 150g, large 240g for an onion; clove 3g), one marked as the default size;
- **a density** in g/ml, for converting volume to mass;
- each with its source and a quality of `source`, `proxy` (the value is borrowed from a similar food, such as cayenne for chilli flakes) or `estimate`.

Pack sizes are not conversions. A line that states its pack ("400g tin") uses it. Otherwise the own layer gives a **typical pack** per ingredient (tinned tomatoes 400g, coriander pack 30g, a bunch of coriander as an estimate). Spoon and cup volumes (5ml teaspoon, 15ml tablespoon, the Australian 20ml tablespoon) are unit facts, not per-ingredient facts, so they live with the units rules, not here.

Prep does not change identity or density in V0.1. "1 cup chopped onion" uses the onion's one density. Prep-specific densities are a later refinement with the same shape.

**How the canonical measure is assigned (derive, then agent review, then owner review where it matters):**

1. **Derived proposal.** The build proposes a dimension for every ingredient with conversion data. It proposes count when the ingredient has a non-spoon item weight and sits under a produce, egg, bread or fish/meat-portion branch. It proposes volume when it sits under a liquid branch (oils, milks, stocks, vinegars, sauces, wines) and has a density. Otherwise it proposes mass.
2. **Agent review.** A Claude Code curation session goes through the proposals and the conversion gaps, writes accepted values into the own layer with `set_by: agent`, and fills gaps it can justify, marked `proxy` or `estimate`.
3. **Owner review.** Every ingredient used by a golden-set line is owner-reviewed (`set_by: owner`), along with anything the agent flags as doubtful. The rest ships as agent-set.

An ingredient with no conversion data and no reviewed proposal gets mass as its dimension and no conversions. Following "unknown beats wrong", the shopping list then keeps differently measured amounts of it apart rather than guess (the exact display belongs to the shopping list rules).

**Linking Intake24 and USDA foods to ingredients** is an own-layer file (ingredient slug to Intake24 food code and USDA FDC id). An agent proposes it by name and food-group matching, and the owner reviews it for golden ingredients. Unlinked ingredients simply get no source measures.

## 7. Resolution, and ingredients the knowledge base lacks

How the engine matches a line to an ingredient (deterministic name lookup, Jev, or both) belongs to [Design the engine pipeline](https://github.com/Ed-Barnes937/FindersEaters/issues/10). The knowledge base supplies a normalised name index (lowercase, singular, accents stripped) over own-layer en-gb names first, then other own-layer names, then OFF names, and the candidates' ancestors.

Each resolved line records one of three outcomes:

- **exact**: it resolves to the ingredient the text names;
- **parent**: no exact entry exists, but a broader one clearly applies ("Kashmiri chilli powder" to chilli powder). The line uses the parent's properties, measures and aisle, and is shown as approximate in review;
- **unresolved**: nothing applies.

An **unresolved line** keeps its text and quantity. It is not merged with other lines on the shopping list, has no aisle beyond "other", and makes every `diet` value unknown for its recipe (unknown blocks the tag). It never matches an `ing:` predicate, and `-ing:` lets it through, as the query model already says.

There are **no household-created ingredients** in V0.1. A user fixes a wrong or missing match with a correction that points the line at an existing ingredient, chosen by autocomplete over names and synonyms. If the right ingredient does not exist, the line stays unresolved until the knowledge base grows. One household's curator is also the owner, so this costs little in V0.1. Household-local ingredients would be an additive change later.

**The gap list** is a query, not a stored queue: unresolved and parent lines across all recipes, grouped by normalised name, with counts and example lines. The owner runs it during curation (a CLI command), and an agent drafts own-layer entries for the most frequent gaps.

## 8. Updates and re-resolution

- **Building.** `kb build` downloads the pinned sources (checksums verified), applies the own layer, runs validation, and produces the `kb` tables plus a **KB version** (a hash of the source pins and the own-layer content).
- **Validation** fails the build when: a slug is duplicated; an own-layer row references a missing OFF id; the "is a" graph has a cycle; a referenced ingredient would vanish without a `replaced_by`; or a golden-set resolution expectation breaks, including one check for each known UK clash (tomato purée is concentrate, not passata; cornflour is corn starch, not maize flour).
- **Upgrading a source** means bumping its pin in a pull request. The build prints a diff report (added, retired, renamed, reparented, property and measure changes) for owner review.
- **Loading.** On deploy, the release command loads the knowledge base when the KB version has changed, in the same transaction pattern as migrations. Loading is idempotent.
- **Re-resolution.** Every recipe records the KB version its resolution used, next to the engine version. A recipe whose KB version is stale is re-resolved through the existing mechanism from the stack ADR: lazily when it is next read, and by the batch re-parse command on a one-off machine. Re-resolution reruns only resolution and what follows it (the parent/unresolved outcome, conversions to canonical measure, derived `diet` tags, protein gating). It never redoes line splitting or line kinds.
- **Corrections win.** A line whose ingredient was set by a correction is not re-resolved. If its ingredient was retired, it follows `replaced_by`.
- **Plans and shopping lists** are not touched by a knowledge base load. A shopping list picks up changes at its next regeneration, which already keeps ticks by ingredient.

## 9. Repo layout (for the product repo)

A `kb` package holds: `sources.json` (pins and checksums), `own/` (YAML files by concern: ingredients, names, edges, dietary, measures, packs, aisles, links, protein branches), the build and validation code, and the gap-list command. Raw downloads are cached, not committed.

## 10. Hand-offs

- **[Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13)**: ingredient with surrogate id, slug, slug aliases, OFF id, retired and `replaced_by`; facts with source; "is a" and "made from" edges with an ancestor closure over "is a" only; resolution outcome and KB version on each line; `set_by` and quality on measures.
- **[Design the engine pipeline](https://github.com/Ed-Barnes937/FindersEaters/issues/10)**: the resolution stage's contract (exact, parent, unresolved), the name index precedence, KB-version staleness, and re-resolution as a partial rerun.
- **[Define shopping list merge and regeneration rules](https://github.com/Ed-Barnes937/FindersEaters/issues/23)**: unresolved and parent lines, typical packs, items with no conversions, aisle inheritance and the aisle values.
- **[Define deploy, migration and backup operations](https://github.com/Ed-Barnes937/FindersEaters/issues/21)**: the KB load step in the release command, and the batch re-resolution run.
