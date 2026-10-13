# Recipe scaling rules

Resolves [Define recipe scaling rules](https://github.com/Ed-Barnes937/FindersEaters/issues/25). Builds on [Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13) (plan item servings are in the recipe's yield kind, null = as written), [Define shopping list merge and regeneration rules](https://github.com/Ed-Barnes937/FindersEaters/issues/23) (section 4 of `docs/spec/shopping-list.md`), the line contract in `docs/spec/engine-pipeline.md`, the recipe view in `docs/spec/search-and-library.md` and the servings stepper in `docs/spec/planner-screen.md`. Feeds the V0.1 spec (`docs/spec/v0.1.md`) and [Write the Claude Design brief](https://github.com/Ed-Barnes937/FindersEaters/issues/17).

Every decision here was made by the agent under the owner's standing rules and is reversible: scaling is a pure function over stored data, nothing it produces is persisted, and the one knowledge base addition is two own-layer properties that default to "scales linearly". Nothing was escalated.

## 1. Shape in one paragraph

Scaling is one pure function, `scale(recipeOutput, target, kb) -> ScaledRecipe`, in a shared package that both the server (shopping list) and the client (recipe view, offline) import. `target` is a number of servings in the recipe's yield kind, or null for "as written". It returns, per line, the scaled amount (a min and max, or a scaled two-measure expression), the **use amount** (one number per line that shopping consumes), the display text, and any **scaling notes**; plus one recipe-level note. The shopping list's `buildList` calls `scale` per plan item instead of multiplying amounts itself, so the recipe view and the list can never disagree about what a cook will use. Scaling notes are not engine flags: they are computed at view time for a given factor, are never stored, never make a recipe need review and never appear on the shopping list.

## 2. The scale factor

| Recipe yield | Target | Factor |
|---|---|---|
| `serves` N | S servings | S / N |
| `makes` N | S items | S / N |
| any | null (as written) | 1 |
| unknown servings | always null | 1 |

- **Ranged yields** ("Serves 4-6") record the **lower bound** as the recipe's servings (an engine stage 8 rule, see section 9). Scaling to 2 then gives half the recipe, not a third: it errs towards enough food, matching shopping's "max of a range". The header still shows the yield as written at factor 1.
- **Servings are whole numbers**, minimum 1, maximum 20 for `serves`.
- **There is no separate multiplier.** Doubling is choosing twice the servings; the stepper shows the factor ("×2", "×½", "×1.5") beside the number whenever it is not 1, so "scale by multiplier" from `docs/ideation/features.md` is covered without a second control or a second stored value.

### 2.1 Makes-recipes step by batch

A `makes` stepper moves in **half batches** when N is even ("Makes 12": 6, 12, 18, 24 ...), otherwise in **whole batches** ("Makes 1 loaf": 1, 2, 3; "Makes 9": 9, 18, 27). The minimum is one step, the maximum ten batches. A plan item for a `makes` recipe still stores the count of things made (12, 24), exactly as the data model and shopping list already say. Stepping up from "As written" lands on two batches; stepping down lands on one step below N.

### 2.2 Unknown servings

A recipe whose servings are unknown always scales at factor 1. Its plan items keep servings null.

- **Recipe view**: the servings fact reads "Servings unknown" with **Set servings**, which asks "How many does this serve?" (or "makes") and writes a recipe-level servings correction through the existing correction mechanism (needs a connection). The stepper appears once servings are known.
- **Planner**: the stepper shows "As written" and is disabled, with the same Set servings action.
- **Shopping list**: the plan item contributes the recipe as written. Its source-line entry is suffixed "(as written)" so a household cooking for six knows the amount is the recipe's, not theirs.
- Setting servings later leaves existing null plan items at "as written", so their shopping amounts do not move. Correcting an already known servings value (4 to 6) changes every non-null plan item's factor, which is right: the correction says what the recipe really makes.

## 3. Where the target comes from on the recipe view

- **Opened from a plan item** (planner row, shopping list "from" link): `/recipes/:id?item=<planItemId>`. The view shows that plan item's servings, labelled "For this plan", and the stepper edits the plan item (the same mutation as the planner's stepper; queued offline like other plan edits).
- **Opened from anywhere else**: the view opens **as written** and the stepper is view-only state held in the URL (`?servings=N`), so back, refresh and sharing keep it. Nothing is stored.
- **Add to plan** from a scaled view creates the plan item with the shown servings instead of the household default.

## 4. Lines at a factor other than 1

At factor 1 every line shows its **original text unchanged**. At any other factor a quantified line is rendered by replacing only its quantity span (and, for a metric promotion, its unit span) in the original text with the scaled amount, so the ingredient, size word, prep and note keep the author's wording ("2 large onions, finely sliced" becomes "4 large onions, finely sliced").

| Line | Rule |
|---|---|
| Unquantified, not an ingredient, section header | Unchanged. |
| Quantified, resolved or not | Scaled. Scaling needs only the parsed amount, never the resolution. |
| Range ("2-3 cloves") | Both ends scaled and rounded; if they round to the same value one number is shown ("4-6 cloves", "2 cloves"). Shopping's use amount is the scaled max. |
| Alternative measure ("250g/9oz") | Both measures scaled, each rounded in its own unit. |
| Pack size inside a line ("1 x 400g tin", "1 tin (400g)") | The pack count scales; the stated pack size does not ("2 x 400g tins"). |
| Size word ("1 large onion") | Unchanged. Scaling never changes size. |

**Units are kept as written.** "2 tbsp" doubles to "4 tbsp", never to "60 ml" or "¼ cup". The only promotion is metric: g to kg and ml to l at 1000 and over. Converting to the household's units belongs to the units display rules (map fog "Display of units"); when those land they apply to the scaled amount, and factor 1 keeps showing the original text.

**Recipe view rounding is to the nearest**, unlike shopping's round-up, because a cook is measuring, not buying:

| Unit kind | Step |
|---|---|
| g or ml | under 10: nearest 0.5 shown as a whole or half ("2.5 g"); 10 to under 100: nearest 5; 100 to under 1000: nearest 10; 1000 and over: kg or l to 0.1 |
| spoons, cups, counts, packs and every other unit | nearest kitchen fraction: ¼, ⅓, ½, ⅔, ¾ or whole ("1½ tbsp", "⅔ cup", "1½ onions") |
| below the smallest step | the smallest step (¼ or 0.5 g), never zero |

## 5. Two-measure arithmetic quantities

The engine keeps "2 cups minus 2 tablespoons" or "1 cup plus 2 tbsp" as an expression of two measures and an operator (`plus` or `minus`), flagged `arithmetic_quantity`.

- **Recipe view**: each measure is scaled and rounded on its own and the operator kept ("4 cups minus 4 tablespoons"). Scaling is linear, so this is always exact and keeps the author's intent; nothing is evaluated for display.
- **Use amount (shopping)**: evaluated in this order, refining section 4.1 of `docs/spec/shopping-list.md`:
  1. Both measures convert to the ingredient's canonical measure: the evaluated expression in canonical (as before).
  2. Otherwise both measures share a dimension through **unit facts alone** (cup and tablespoon are both volume, oz and g both mass): the evaluated expression in the **first measure's unit**, contributing to that unit's as-written group. No ingredient density is needed for this.
  3. Otherwise (cross-dimension, "1 cup plus 50 g"): for `plus`, **both measures contribute** separately (one may land in the canonical group, the other as written); for `minus`, the first measure alone. This never under-buys: dropping the second term of a `plus` would.

## 6. Scaling notes: ingredients that do not scale cleanly

A scaling note is attached to a line only when the factor is not 1, and says in words what the cook should do. There are three line-level notes and one recipe-level note. Each line shows at most one note (whole-only first, then part pack, then seasoning).

| Note | Trigger | Rule and wording |
|---|---|---|
| **Whole only** | The line's ingredient has the own-layer property `whole_only` (eggs, bay leaves, cinnamon sticks, star anise, cardamom pods, cloves (spice), vanilla pods, stock cubes, chillies when counted) and the scaled count is not whole | The amount is **rounded to the nearest whole, never below 1**, and that rounded value is also the use amount, so shopping buys what the cook will use. Note: "Rounded from 1½". |
| **Part pack** | The line is counted in a pack unit (tin, can, jar, pack, carton, packet, bag, block, sachet) and the scaled count is not whole | The amount shows the fraction plus its weight or volume where the pack size is known ("1½ tins (600 g)"). Note: "Part tin - keep the rest". Shopping's pack hint already rounds packs up. |
| **Seasoning** | The line's ingredient has the own-layer property `seasoning` (salt, pepper, ground and whole spices, spice blends and curry powders, dried herbs, chilli in every form, curry and spice pastes, fish sauce, soy sauce, Worcestershire sauce, MSG) and the factor is above 1.5 | The amount is scaled linearly (no invented exponent: unknown beats wrong). Note: "Strong flavour - start with less and add to taste". |
| **Times and sizes** (recipe level) | Any factor other than 1 | One line above the ingredients: "Scaled ×2. Cooking times and tin or pan sizes are as written - check the method." Always shown, because the app does not read the method for times or tin sizes in V0.1. |

- **Where the properties live**: `whole_only` and `seasoning` are boolean own-layer properties in the food knowledge base, set on high "is a" branches and inherited down them, nearer explicit value wins (the same pattern as aisles). Missing means false, so an unseeded ingredient scales linearly with no note. They are curated like every other own-layer fact, and seeding the two lists above is part of the KB curation pass.
- **Unresolved lines** have no properties, so they only ever get the part pack note.
- **Leaveners and baking**: no separate rule. Makes-recipes scale in half or whole batches, where leaveners scale linearly; the times-and-sizes note covers the one real risk (one bigger tin). A baking-specific rule can be added when real use shows a need.
- **Halving eggs** ("3 eggs" for a half batch) gives 1½, rounded to 2 with "Rounded from 1½": deliberate, since home cooks rarely measure half an egg.

## 7. Shopping list consequences

`buildList` uses `scale(recipe, planItem.servings)` and takes each line's use amount: the scaled max of a range, the evaluated or split arithmetic expression (section 5), whole-only counts already rounded. Everything after that (amount groups, round-up for display, pack hints, always-haves) is unchanged. Two plan items each needing 1½ eggs therefore put 4 eggs on the list, not 3, matching what the two cooks will crack.

## 8. Scenarios checked

| Scenario | Result |
|---|---|
| Chilli serves 4, plan item 2 | ×½; "1 tin chopped tomatoes" shows "½ tin (200 g)" with "Part tin - keep the rest"; list shows 200 g · 1 tin. |
| Carbonara serves 2 with 3 eggs, plan item 3 | ×1.5; 4.5 eggs rounds to 5 (nearest, half up), "Rounded from 4½"; list buys 5. |
| Curry serves 4, plan item 8 | ×2; "2 tsp garam masala" shows "4 tsp" with the seasoning note; times-and-sizes line shown. |
| Biscuits makes 12, plan item null | As written; stepper offers 6 or 24 next. |
| Stew, servings unknown | Factor 1, "Servings unknown · Set servings"; list entry "Stew (as written)". |
| "1 cup plus 2 tbsp flour", flour has a density | Evaluated in g in the canonical group. |
| "1 cup plus 2 tbsp" of an unresolved ingredient | Evaluated as 1.125 cups in the cup as-written group. |
| Serves 4-6, plan item 2 | Servings recorded as 4; ×½. |

## 9. What this asks of other tickets

- **Engine (stage 8, `docs/spec/engine-pipeline.md`)**: a ranged yield records its lower bound as servings. Arithmetic expressions carry their operator (`plus` or `minus`). Pack sizes stated inside a line are kept as pack size, apart from an alternative measure. Quantity and unit spans keep their offsets so the view can replace them.
- **Food knowledge base (`docs/spec/food-knowledge-base.md`)**: two inherited boolean own-layer properties, `whole_only` and `seasoning`, seeded on the branches listed in section 6; pack units listed in the unit lexicon as pack units.
- **Shopping list (`docs/spec/shopping-list.md`)**: section 4.1 calls `scale` and takes use amounts; the arithmetic fallback becomes section 5 above; the "(as written)" suffix on source entries for unknown-servings recipes.
- **Recipe view (`docs/spec/search-and-library.md`)**: the servings fact is the stepper of section 2 with the factor badge, "For this plan" when opened with `?item=`, and the times-and-sizes line above ingredients when scaled.
- **Planner (`docs/spec/planner-screen.md`)**: makes-recipes step by batch; unknown-servings items show a disabled stepper with Set servings.
- **[Write the Claude Design brief](https://github.com/Ed-Barnes937/FindersEaters/issues/17)**: the servings stepper with factor badge, inline scaling notes on lines, and the recipe-level times-and-sizes line are must-shows.
