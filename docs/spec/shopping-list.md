# Shopping list: merge and regeneration rules

Resolves [Define shopping list merge and regeneration rules](https://github.com/Ed-Barnes937/FindersEaters/issues/23). Builds on the in-shop flow from [Prototype the shopping list in the shop](https://github.com/Ed-Barnes937/FindersEaters/issues/16) (`docs/prototypes/shopping-list/index.html`), the line contract in `docs/spec/engine-pipeline.md` and the measures, packs and aisles in `docs/spec/food-knowledge-base.md`. Feeds the V0.1 spec (`docs/spec/v0.1.md`), [Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13) and [Write the Claude Design brief](https://github.com/Ed-Barnes937/FindersEaters/issues/17).

Every decision here was made by the agent under the owner's standing rules and is reversible: the list is a pure function of data that is stored anyway, and the only new stored state is a small tick record per item.

## 1. Shape in one paragraph

The shopping list is **computed, not stored**. A pure function `buildList(planItems, recipes, alwaysHave, kb, ticks) -> ShoppingList` runs on the server every time the list is read. It takes each plan item's recipe (its effective output: engine output with corrections applied), scales it to the plan item's servings, turns each eligible line into a contribution, groups contributions into **shopping items** by key, merges amounts per item, assigns aisles, applies always-have coverage and overlays the stored ticks. "Regenerated when the plan changes" therefore holds by construction: there is no stale copy to refresh. The only household state is the tick record (section 8). The phone caches the last list it loaded for offline use, exactly as the prototype ticket set out.

Why computed: it removes every "when do we regenerate" trigger (plan edits, servings changes, corrections, re-parses, knowledge base loads and always-have edits all show up on the next read), and the work is tiny (a plan is tens of recipes at most, each with tens of lines). A materialised list can be added later as a cache with no change to the rules.

## 2. Which lines reach the list

Input per plan item: the recipe's effective lines, in order, after segmentation (compound lines are already split into parts; headers are not lines).

| Line | On the list? | Contribution |
|---|---|---|
| Quantified, resolved (exact or parent) | Yes | Amount in the ingredient's canonical measure, scaled. |
| Quantified, resolved, no conversion path | Yes | Amount as written (quantity plus unit), scaled. |
| Unquantified ("salt, to taste") | Yes | "some", with the line's wording kept for the source line. |
| Unresolved | Yes | Its own item, keyed by its text (section 3). Amount as written, scaled. |
| Not an ingredient (tap water, ice) | No | - |
| Optional | Yes, marked | As its kind above, marked optional (section 6). |
| Alternatives ("butter or margarine") | First option only | The first alternative contributes; the source line notes "or margarine". |

**Parent-resolved lines** are the parent ingredient for shopping: "Kashmiri chilli powder" resolved to chilli powder joins the chilli powder item, and its source line shows the recipe's own wording ("Dal 1 tsp, Kashmiri").

**Serve-with lines the recipe lists** ("rice, to serve") are ordinary unquantified lines. With a quantity ("300g basmati rice, to serve") they are ordinary quantified lines whose note shows in the source line.

## 3. Item keys: what merges with what

One item per **key**:

- A resolved line's key is its **ingredient id**. Lines merge only when they resolve to the same ingredient. There is no merging up the hierarchy: cheddar and "cheese" stay two items, because buying one does not settle the other and guessing would be wrong (unknown beats wrong).
- An unresolved line's key is `unresolved:` plus its **normalised ingredient text** (lower case, whitespace collapsed, the parsed span). Two unresolved lines merge only when that text is identical. This refines the knowledge base spec's "unresolved lines are not merged": they never merge with a resolved ingredient or with differently worded text, but identical wording is the same thing and gives ticks a stable key.
- A retired ingredient id follows `replaced_by` before keying, as the knowledge base spec already requires for corrections.

## 4. Amounts

### 4.1 Scaling per plan item

`factor = plan item servings / recipe servings` when the recipe's yield kind is servings. For a "makes N" recipe the plan item's servings count the things made (12 biscuits), so `factor = plan item servings / N`. When the recipe's servings are unknown, `factor = 1` (the plan item defaults to the recipe as written, and the existing `servings_unknown` flag already asks for a fix). Every quantity on the plan item's lines is multiplied by the factor before merging.

Shopping needs one number per line, so it settles two scaling inputs for itself (the recipe view's scaling display stays with the scaling fog on the map):

- **Ranges** ("2-3 cloves") use the **max**. Shopping errs towards having enough.
- **Arithmetic quantities** ("2 cups minus 2 tablespoons") use the evaluated expression when both measures convert to the canonical measure, otherwise the first measure alone.

### 4.2 Merging within an item

An item's contributions fall into **amount groups**:

- the **canonical group**: every amount that converted to the ingredient's canonical measure (g, ml or count), summed exactly (no rounding until display);
- one **as-written group per unit** for amounts with no conversion path, keyed by the unit lexicon's unit id (or the raw unit word when the lexicon has none), each summed in that unit;
- the **some flag**: set when any contribution is unquantified.

Different groups never convert into each other, so a stock item with "800 ml" in its canonical group and "1 cube" as-written shows both. A pack line ("1 tin chopped tomatoes") is not as-written: the engine already converted it through the stated or typical pack size into the canonical measure.

### 4.3 Display

The amount text is the groups joined with " + ", canonical group first, then as-written groups in first-seen order, then "some":

Examples: "400 g", "40 g + some", "800 ml + 1 cube". "Some" is never shown alone: an item with only unquantified contributions shows **no amount**, and the source line carries the wording.

**Rounding is always up**, to a step that depends on size, and happens only for display:

| Canonical | Amount | Shown as |
|---|---|---|
| g or ml | under 10 | up to the next whole unit ("3 g") |
| g or ml | 10 to under 100 | up to the next 5 ("45 ml") |
| g or ml | 100 to under 1000 | up to the next 10 ("260 g") |
| g or ml | 1000 and over | kg or l, up to the next 0.1 ("1.3 kg") |
| count | any | up to the next whole, with the item name ("3 onions", "6 cloves") |

As-written groups round the same way by their unit's kind: metric units by the table, every other unit (tin, cube, bunch, cup, tbsp) up to the next half below 3 and the next whole from 3 ("1.5 cups", "4 tbsp").

**Pack hint.** When the own layer gives the ingredient a typical pack, the amount is followed by the packs needed, rounded up: "800 g · 2 tins", "10 g · 1 pack". The amount stays the primary figure, because the app does not know which shop or pack the household buys.

### 4.4 Source line

Under the item name, one entry per recipe: the recipe's short title and its scaled contribution in display form ("Chilli 400 g · Dal 2 tins"), or its wording for unquantified lines ("to taste", "for frying", "to serve"). A recipe that appears as more than one plan item shows once with the summed contribution and "×2". Entries follow plan order.

## 5. Always-have coverage

An always-have entry is an ingredient id. It **covers** an item when the item's ingredient is:

1. the same ingredient;
2. a **descendant** of it through "is a" (always-have olive oil covers extra virgin olive oil, because a household that keeps olive oil does not buy a second bottle for a recipe that says "extra virgin");
3. an **ancestor** of it through "is a" (a recipe asking for generic "oil" is satisfied by the olive oil the household keeps).

Siblings never cover each other (always-have olive oil does not cover sesame oil, since both sit under oil but neither is the other's ancestor). "Made from" edges never cover (always-have chicken stock cubes do not cover chicken).

The cost of a broad always-have ("oil" covering sesame oil) is visible and one tap: the item starts in **At home** and unticking it moves it to its aisle for this list. The always-have editor should suggest common items at a useful level (salt, black pepper, olive oil, vegetable oil, plain flour) so households rarely pick a branch as broad as "oil"; that suggestion list is an own-layer fact.

Unresolved items are never covered (they have no ingredient). Covered items still show their amount in At home ("Olive oil 45 ml + some"), so the household can judge whether they are running low.

## 6. Optional lines

An optional line contributes like any other line, so its amount is included (shopping errs towards having enough). Its source entry is suffixed "(optional)". When **every** contribution to an item is optional, the item shows an **optional** badge, so the shopper can skip it knowingly. Optional items are counted in "N of M to get".

## 7. Serve-with items

The engine emits nothing new. The shopping function derives serve-with items from what the engine already produces:

- A recipe's applied `carb` tag value adds an unquantified **serve-with** contribution for that value's ingredient, unless one of the recipe's own lines resolves to that ingredient or a descendant of it.
- Value to ingredient: `rice` to rice, `pasta` to pasta, `noodles` to noodles, `potato` to potatoes, `bread` to bread. `pastry` and `grains` derive nothing: pastry as a base is always in the ingredients, and "other grains" names no single thing to buy.
- The contribution is suppressed when another plan item **on the same date** has a line resolving to that ingredient or a descendant (a planned rice side already covers "serve with rice").
- A serve-with contribution behaves as an unquantified line: it merges into the ingredient's item (adding "some"), its source entry reads "Chilli · serve with", and an item whose only contributions are serve-with shows the **serve with** badge from the prototype.

Recipes that list their serve-with carb as a line ("rice, to serve") never derive one, by the first rule. A tag that is wrong costs one unneeded row; a correction to the tag removes it.

## 8. Ticks and regeneration

**The tick record** is the only stored list state: per (shopping list, item key), `ticked` (true or false), `tickedAt` (the device time of the tap) and, for a tick, `snapshot`: the amount groups the shopper saw when ticking (exact canonical sums per group plus the some flag). Later tick wins per key by `tickedAt`, as the prototype ticket set out. Offline taps queue on the phone carrying the same three fields, coalesced to the latest per key.

**Effective tick state** is computed on every read:

- No record: ticked if covered by an always-have (At home), otherwise unticked.
- A record with `ticked: false`: unticked. For an always-have item this is "out of it for this shop", and it sits in its aisle.
- A record with `ticked: true`: ticked, **unless the current need exceeds the snapshot**. Then the item shows unticked in its aisle with a "was 4" badge (the snapshot in display form). Ticking it again writes a new record with the new snapshot.
- Always-have items covered and ticked by default have no snapshot and keep their tick whatever the amount, as the prototype set out.

**"Exceeds"** means any of: an amount group's exact sum is larger than in the snapshot; an amount group exists that the snapshot did not have; or the snapshot had only "some" and the item is now quantified. Going from quantified to quantified-plus-some is not an increase.

Consequences, all by construction:

- An amount that goes up and back down before the shopper looks keeps its tick (no spurious untick).
- A removed recipe's items disappear, but their tick records stay. If the item comes back within its snapshot, it is still ticked: it was bought.
- A correction that changes a line's key (an unresolved line corrected to an ingredient) starts a new, unticked key. The old record is ignored. This is rare and safe.
- Knowledge base loads and re-parses reach the list on its next read with no regeneration step.

**Sections and counts** (all derived, no extra state): ticked and covered by always-have with no record is At home; ticked otherwise is In the basket (most recent tick first); everything else is in its aisle. "N of M to get" counts every item not At home.

## 9. Aisles

The aisle set and walk order are fixed in V0.1:

1. Fruit & veg
2. Bakery
3. Meat & fish
4. Dairy & eggs
5. Cupboard
6. Spices & seasonings
7. Oils, sauces & condiments
8. Frozen
9. Other

Within an aisle, items sort alphabetically by display name. Empty aisles are hidden. A per-household order is an additive later change.

**Assignment.** An item's aisle is the own-layer aisle on its ingredient, or else on its nearest "is a" ancestor that has one. No aisle anywhere on the path gives Other, and the gap list reports it. Unresolved items are always Other. The own layer sets aisles on high branches and overrides children that shop elsewhere.

**Seed assignment** for the own-layer `aisles` file (branch names are descriptive; the curation session maps them to OFF or own ids):

| Aisle | Branches | Overrides worth seeding |
|---|---|---|
| Fruit & veg | fruits, vegetables, fresh herbs, mushrooms, fresh chillies, fresh ginger and garlic | dried fruit to Cupboard; tinned and frozen forms to their aisles |
| Bakery | breads, wraps, flatbreads, tortillas, naan, buns | breadcrumbs to Cupboard |
| Meat & fish | meat, poultry, fish, seafood, bacon and cured meats | tinned fish to Cupboard; stocks and stock cubes to Cupboard |
| Dairy & eggs | milk, cream, butter, cheese, yoghurt, eggs, plant milks | tofu and fresh pasta to Dairy & eggs (UK chilled) |
| Cupboard | flours, sugars, rice, pasta, noodles, grains, dried and tinned pulses, tinned tomatoes, stocks, nuts, seeds, baking ingredients, dried fruit, coconut milk | |
| Spices & seasonings | spices (whole and ground), dried herbs, salt, pepper, curry powders and spice blends | |
| Oils, sauces & condiments | oils, vinegars, sauces, condiments, curry pastes, honey, syrups, mustards | |
| Frozen | only by override: frozen peas, frozen spinach, frozen berries, puff pastry sheets bought frozen | |
| Other | anything unassigned; unresolved lines | cooking wine and spirits until a drinks aisle exists |

Fresh versus dried forms (coriander versus dried coriander, fresh versus ground ginger) are separate ingredients in the hierarchy already (the knowledge base spec puts ground and whole forms under each spice), so they reach different aisles without special rules.

## 10. Inputs for other tickets

- **[Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13)**: no stored list rows. A shopping list is identified per plan and holds tick records keyed by (list, item key) with `ticked`, `tickedAt` (device time) and `snapshot` (amount groups and some flag, as JSON). Item keys are ingredient ids or `unresolved:<normalised text>`. This replaces the prototype ticket's "the list keeps the amounts it was last generated with": the snapshot lives on the tick, which handles increase then decrease correctly. Always-have entries are ingredient ids. The plan item's servings mean things made for a "makes N" recipe.
- **[Write the Claude Design brief](https://github.com/Ed-Barnes937/FindersEaters/issues/17)**: amount text forms ("40 g + some", "800 ml + 1 cube", "800 g · 2 tins", no amount for unquantified-only), the optional and serve-with badges, "(optional)" and "serve with" in source lines, the "was N" badge.
- **Own layer (knowledge base curation)**: the aisle seed table above; typical packs with a pack noun (tin, pack, jar, bunch) for the pack hint; a short always-have suggestion list.
- **Scaling (map fog)**: shopping uses max of a range and the evaluated arithmetic expression (else the first measure). The recipe view's scaling display is still open.
