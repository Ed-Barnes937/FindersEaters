# Tag taxonomy (V0.1)

Resolves [Design the tag taxonomy](https://github.com/Ed-Barnes937/FindersEaters/issues/7). Feeds the V0.1 spec (`docs/spec/v0.1.md`), the engine pipeline, the query model, suggestion scoring and the golden set.

Every decision here was made by the agent under the owner's standing rules and is reversible: tags are engine output, and the engine can re-tag the whole library cheaply (Jev costs fractions of a penny per recipe) whenever the taxonomy changes.

## Summary

| Dimension | Slug | Cardinality | How it is set | Read by |
|---|---|---|---|---|
| Meal type | `meal` | Multi, at least one | Classified | Suggestion request filter, search |
| Cuisine | `cuisine` | Single, optional | Classified | Variety, search |
| Main protein | `protein` | Multi, may be empty | Classified, then gated by ingredients | Variety, search |
| Carb base | `carb` | Multi, may be empty | Classified | Variety, search |
| Method | `method` | Single | Classified | Variety, search |
| Effort | `effort` | Single, ordinal | Classified | Soft signal, search |
| Equipment | `equipment` | Multi, may be empty | Classified | Search |
| Dietary | `diet` | Multi, may be empty | Derived from the ingredient hierarchy | Search, later hard rules |

Plus **user tags**: free-form, household-owned, search only.

Changes from the ten dimensions proposed in `docs/ideation/README.md`:

- **Time is not a tag.** It is a number (total minutes), a recipe-level fact in the engine output. Bucketing it into tags would throw away precision the query model needs (`time:<30`). Display bands ("under 30 min") are a UI concern.
- **Season is dropped for V0.1.** Nothing in V0.1 reads it: semantic search is out, and the planner's soft signals are favourites, effort, overlap and variety. It is also the vaguest dimension to define. Adding it later is a new dimension plus a re-tag. Households can use a user tag meanwhile.
- **`one_pot` is not a method.** The Jev spike showed it overlaps every real method (a slow-cooker chilli is both). It describes washing up, not cooking. It is a good candidate for a user tag.
- **`bbq` moves from method to equipment.** Cooking over direct fire is `grill`; needing a barbecue is equipment.
- **Method becomes single-valued** (the defining cooking step), which removes the multi-label ambiguity the spike hit on R03.

## Principles

1. **A tag is a recipe fact, a user tag is a household fact.** Fixed tags belong to the engine output (plus corrections), so they are the same in every household that imports the same recipe. User tags belong to the household, alongside favourites and notes.
2. **Fixed dimensions are closed sets.** Every value has a stable slug, a display label and a written definition. The definition is the text Jev is given and the text the golden set is graded against, so they cannot drift apart.
3. **Definitions are non-overlapping within a dimension.** Where two values could both apply, the definition says which wins. Multi-valued dimensions are multi-valued because real recipes have several true answers, not to dodge a boundary.
4. **Derive before classifying.** If a tag can be computed from parsed ingredients and the ingredient hierarchy, it is derived, not guessed (dietary). If a classification can be checked against the ingredients, it is (main protein).
5. **Unknown is a valid answer.** A tag the engine is not confident about is not applied. Unknown is better than wrong, because the planner treats unknown as neutral, while a wrong tag actively misleads search and variety.
6. **Planner-facing dimensions are coarse.** Cuisine, protein, carb and method feed "treat the week as a set", so their values are pitched at the level a cook would call "the same again" (two curries are both `indian`; korma and madras need not differ).

## Mechanics

### Applying tags

- **Single-valued dimensions** (`cuisine`, `method`, `effort`) are one Jev Choice over the dimension's values plus `none`. The value applies if confidence is at or above the dimension's threshold; otherwise the dimension is left unknown and the top answer is offered as a suggestion in the review screen.
- **Multi-valued dimensions** (`meal`, `protein`, `carb`, `equipment`) are one Jev Noul per value, each with its own threshold, as the spike recommended.
- **Meal type always has at least one value.** If no Noul passes, a Choice over the same values picks one, flagged for review. A recipe with no meal type could never be suggested.
- **Main protein is gated by the ingredients.** A `protein` value only applies if a parsed ingredient resolves under the matching branch of the ingredient hierarchy. This stops a "serve with grilled chicken" suggestion becoming a protein, and catches hallucination cheaply.
- **Carb base is not gated**, because "serve with rice" is a real carb base even when rice is not in the ingredient list. (How that interacts with the shopping list is part of [Decide whether a plan item is one recipe or a meal](https://github.com/Ed-Barnes937/FindersEaters/issues/3).)
- **Thresholds** start at 0.8 for every value (the spike's "always correct" line) and are tuned per value against the golden set. They live in engine configuration, not the taxonomy.
- **Jev input** for tagging is the recipe title, the parsed ingredient lines and the method text.

### Dietary derivation

- A `diet` value applies only if **every** ingredient line that is *quantified* or *unquantified* resolves to a knowledge-base entry that has the matching property. Lines classified *not an ingredient* are ignored.
- **Unknown blocks the tag.** One unresolved ingredient, or one entry with no data for that property, means the tag is not applied. Dietary tags are positive claims, so they must be conservative.
- **Optional lines count.** "Parmesan, to serve (optional)" stops `vegetarian`. This is conservative and simple; a later "vegetarian if you skip X" is possible once the engine marks optional lines.
- **Dietary tags are not directly correctable.** The user corrects the input instead (resolve "parmesan" to "vegetarian hard cheese"), and the tag follows. This keeps one source of truth and survives re-parsing.
- **They are a guide, not allergen safety.** The UI must say so wherever dietary tags are shown or filtered on. Packaged ingredients (stock cubes, soy sauce, Worcestershire sauce) vary by brand.
- A value is only offered if the seeded knowledge base carries the property it needs. If the seed lacks a property (see [Decide how the food knowledge base is seeded](https://github.com/Ed-Barnes937/FindersEaters/issues/9)), that value is hidden rather than guessed.

### Corrections

- A user can add or remove any classified tag value, and set or clear a single-valued dimension. Each change is a correction, so it survives re-parsing.
- After a re-parse, the effective tags are the engine's tags with corrections applied on top. A correction that removes a value the engine no longer produces is harmless.
- Engine tags below threshold appear in review as one-tap suggestions ("Cuisine: Italian?").

### Versioning

- The taxonomy is code-owned configuration in the repo, versioned as a whole. Each engine output records the taxonomy version it was tagged against.
- Adding a value or dimension: bump the version and re-tag. Renaming a value: a migration that rewrites stored slugs and corrections. Removing a value: corrections that mention it are dropped, and the change is noted in the changelog.
- Slugs are lowercase `snake_case` and never reused for a different meaning.

### Query and planner contract

- In the query model, a fixed tag is `dimension:value` (`cuisine:italian`, `-diet:vegan`), and a user tag is `tag:name`. The namespaces never collide, so a user tag called "pasta" never shadows `carb:pasta`.
- Unknown is queryable distinctly (`cuisine:unknown` style); the exact syntax belongs to [Define the query model](https://github.com/Ed-Barnes937/FindersEaters/issues/11).
- Variety and similarity in [Design suggestion scoring and selection](https://github.com/Ed-Barnes937/FindersEaters/issues/12) read `cuisine`, `protein`, `carb` and `method`. A missing value contributes no similarity, never a match. User tags never feed scoring: they are opaque to the planner.
- The suggestion request's "which meal types" parameter matches against `meal`.

## Free-form boundary: user tags

- **Fixed dimensions hold anything the system reasons about.** If search filters, planner variety or rules need to understand a label, it belongs in a fixed dimension with a definition.
- **User tags hold anything only the household understands**: "Ed's birthday", "from Gran", "one pot", "summer", "freezes well". The app stores and filters on them but never interprets them.
- User tags are owned by the household (personal layer), so the same recipe can carry different user tags in different households.
- Names are trimmed and compared case-insensitively ("One Pot" and "one pot" are the same tag); display keeps the first spelling used.
- V0.1 includes them minimally: add or remove on the recipe view, filter on them in search, autocomplete from the household's existing tags. They are the release valve for everything this taxonomy deliberately leaves out.
- Promotion path: if many households use the same user tag for something the system should understand, it becomes a candidate fixed value or dimension (with a definition), and is then applied by the engine.

## Dimensions and definitions

The **definition** column is the text given to Jev and used to grade the golden set. Display labels are UK English.

### Meal type (`meal`): multi, at least one

Question: "Would a UK home cook serve this as …?"

| Value | Label | Definition |
|---|---|---|
| `breakfast` | Breakfast | Eaten as the first meal of the day: porridge, eggs on toast, pancakes, granola, a fry-up. |
| `lunch` | Lunch | A lighter meal suited to the middle of the day: soups, salads, sandwiches, wraps, things on toast, small plates. |
| `dinner` | Dinner | The main meal of the day, served on its own or with simple sides: curries, pasta dishes, pies, roasts, stews, stir-fries. |
| `side` | Side | Served alongside a main rather than as a meal: roast potatoes, rice, slaw, garlic bread, dressed greens. |
| `dessert` | Dessert | A sweet course eaten after a meal: puddings, crumbles, tarts, ice cream. |
| `baking` | Baking | Sweet or savoury bakes eaten between meals or kept in a tin: cakes, biscuits, scones, loaves, bread. |
| `snack` | Snack | Small savoury bites eaten between meals or as nibbles: dips, energy balls, popcorn, sausage rolls. |
| `basics` | Basics | A component made to use in other recipes, not eaten on its own: stocks, sauces, dressings, pastry, spice mixes, chutneys. |

Boundaries: a soup is usually `lunch` and `dinner`. Bread is `baking` (and `side` if it is presented as an accompaniment). `basics` is never suggested by the planner on its own; it is the hook for sub-recipes later. Drinks are not a value: use a user tag.

### Cuisine (`cuisine`): single, optional

Question: "Which culinary tradition would a UK home cook say this dish comes from?"

Rule: tag the tradition the dish is identified with, not where its ingredients come from. Anglicised classics take the tradition they name (spaghetti bolognese is `italian`, chicken tikka masala is `indian`). Fusion takes the dominant tradition. Dishes with no clear tradition (plain roast vegetables, a green salad) are `none`.

| Value | Label | Definition |
|---|---|---|
| `british` | British | British and Irish home cooking: roasts, pies, stews, crumbles, fry-ups, cottage pie. |
| `french` | French | French cooking: gratins, bourguignon, quiche, tarte tatin. |
| `italian` | Italian | Italian cooking: pasta dishes, risotto, pizza, Italian-American classics. |
| `spanish_portuguese` | Spanish and Portuguese | Iberian cooking: paella, tortilla, tapas, piri-piri (Portuguese style). |
| `greek_turkish` | Greek and Turkish | Greek, Cypriot and Turkish cooking: moussaka, souvlaki, kofte, pide. |
| `middle_eastern` | Middle Eastern | Levantine, Persian and Gulf cooking: shawarma, fattoush, khoresh, mezze plates. |
| `north_african` | North African | Moroccan, Algerian, Tunisian, Libyan and Egyptian cooking: tagines, shakshuka, harissa dishes. |
| `african` | African | Sub-Saharan African cooking: jollof, peanut stews, bobotie, injera dishes. |
| `central_eastern_european` | Central and Eastern European | German, Austrian, Polish, Hungarian, Russian and Ukrainian cooking: goulash, pierogi, schnitzel. |
| `nordic` | Nordic | Scandinavian and Finnish cooking: meatballs with lingonberry, gravlax, cinnamon buns. |
| `indian` | Indian | South Asian cooking (India, Pakistan, Bangladesh, Sri Lanka, Nepal) and British-Indian restaurant dishes: curries, dals, biryanis. |
| `chinese` | Chinese | Chinese cooking and British-Chinese takeaway dishes: stir-fries, chow mein, sweet and sour, dumplings. |
| `japanese` | Japanese | Japanese cooking: katsu, ramen, teriyaki, donburi. |
| `korean` | Korean | Korean cooking: bibimbap, bulgogi, kimchi dishes. |
| `thai` | Thai | Thai cooking: green and red curries, pad thai, larb. |
| `south_east_asian` | South-East Asian | Vietnamese, Malaysian, Indonesian, Filipino and Singaporean cooking: pho, rendang, nasi goreng, adobo. |
| `mexican` | Mexican | Mexican and Tex-Mex cooking: tacos, fajitas, chilli con carne, enchiladas. |
| `latin_american` | Latin American | Central and South American cooking other than Mexican: empanadas, ceviche, feijoada. |
| `caribbean` | Caribbean | Caribbean cooking: jerk, rice and peas, curry goat, roti. |
| `american` | American | US cooking other than Tex-Mex and Italian-American: burgers, mac and cheese, barbecue, pancakes. |
| `none` | - | No clear tradition, or a generic preparation. |

Golden set note: shakshuka is `north_african` by this definition (Maghrebi origin); the golden set should accept `middle_eastern` as a near miss but expect `north_african`.

### Main protein (`protein`): multi, may be empty

Question: "Is X one of the main proteins the dish is built around?" A main protein is one a cook would name when describing the dish ("chicken and chorizo stew"). Flavourings and garnishes are not main proteins: two rashers of bacon in a lentil soup are not `pork`; parmesan grated over pasta is not `cheese`.

| Value | Label | Definition |
|---|---|---|
| `chicken` | Chicken | Chicken in any cut or form. |
| `other_poultry` | Turkey and duck | Turkey, duck, goose and other poultry except chicken. |
| `beef` | Beef | Beef and veal, including mince and steak. |
| `pork` | Pork | Pork, including bacon, ham, gammon, sausages and chorizo. |
| `lamb` | Lamb | Lamb and mutton. |
| `game` | Game | Venison, rabbit, pheasant, pigeon and other game. |
| `fish` | Fish | Finned fish, fresh, frozen, smoked or tinned: salmon, cod, mackerel, tuna. |
| `shellfish` | Shellfish | Prawns, mussels, crab, squid, scallops and other shellfish. |
| `egg` | Egg | Eggs as a main element of the dish (frittata, shakshuka), not as a binder or glaze. |
| `cheese` | Cheese | Cheese as a main element (macaroni cheese, halloumi skewers), not as a topping. |
| `pulses` | Pulses | Beans, lentils, chickpeas and peas used as a main element. |
| `soy` | Tofu and tempeh | Tofu, tempeh and edamame as a main element. |
| `meat_alternative` | Meat alternatives | Plant-based or mycoprotein substitutes: Quorn, plant mince, vegan sausages. |

Empty is normal for sides, desserts, baking and basics. Each value is gated by the ingredient hierarchy (see Mechanics).

### Carb base (`carb`): multi, may be empty

Question: "Is X the main starchy base of the meal, as cooked or as the recipe says to serve it?"

| Value | Label | Definition |
|---|---|---|
| `rice` | Rice | Rice of any kind, cooked in the dish or served with it. |
| `pasta` | Pasta | Wheat or egg pasta, including gnocchi. |
| `noodles` | Noodles | Asian-style noodles: egg, rice, udon, soba, glass. |
| `potato` | Potato | Potatoes and sweet potatoes in any form: mash, roast, chips, jackets. |
| `bread` | Bread | Bread, wraps, flatbreads, tortillas, buns and toast as the base. |
| `pastry` | Pastry | Pastry as the base or casing: pies, tarts, pasties, en croute. |
| `grains` | Other grains | Grains other than rice and wheat pasta: couscous, bulgur, quinoa, pearl barley, polenta, freekeh. |

A shepherd's pie is `potato`; a pie served with mash is `pastry` and `potato`. A salad with no starch is empty. A recipe that says "serve with rice or naan" takes the first-named option only.

### Method (`method`): single

Question: "What is the defining cooking step of this dish?" The defining step is the one that gives the dish its character, usually the longest or last cooking step, not preparation like browning onions first.

| Value | Label | Definition |
|---|---|---|
| `roast` | Roast | Cooked uncovered in a hot oven to brown the main item: roast joints, roast vegetables, tray roasts and traybakes of meat or veg. |
| `bake` | Bake | Cooked in the oven as a mixture, dough, batter or assembled dish: cakes, bread, pies, lasagne, gratins, crumbles. |
| `grill` | Grill | Cooked by direct radiant heat: under a grill, on a griddle pan or over a barbecue. |
| `fry` | Fry | Cooked quickly in a pan with a little fat: stir-fries, sautés, pan-fried fish, omelettes, fritters. |
| `deep_fry` | Deep fry | Submerged in hot oil, or air-fried as a substitute for it: chips, tempura, fried chicken. |
| `simmer` | Simmer | Cooked in liquid on the hob for under two hours: curries, soups, sauces, risotto, poached and boiled dishes. |
| `slow_cook` | Slow cook | Cooked at low heat for two hours or more, in any appliance: slow cooker, low oven, or a long hob braise. |
| `steam` | Steam | Cooked in steam: steamed fish, dumplings, steamed puddings. |
| `pressure_cook` | Pressure cook | Cooked under pressure in a pressure cooker or multicooker. |
| `no_cook` | No cook | No heat applied to the dish as a whole: salads, cold desserts, dips, overnight oats. |

Boundaries: a browned-then-slow-cooked chilli is `slow_cook` (golden R03 should expect `slow_cook`, not `fry`). A lasagne is `bake` even though its sauce simmers first. A traybake of chicken thighs is `roast`; a traybake cake is `bake`.

### Effort (`effort`): single, ordinal

Question: "How much hands-on effort and skill does this take for a typical home cook?" Hands-on time only; waiting time (marinating, slow cooking) does not count.

| Value | Label | Definition |
|---|---|---|
| `easy` | Easy | About 20 minutes or less hands-on, basic skills only (chop, stir, fry, boil), one main thing on the go at once. |
| `medium` | Medium | Up to about an hour hands-on, or a few components to time together, or one technique that needs attention (making a roux, a risotto). |
| `hard` | Hard | Over an hour hands-on, or demanding technique (laminated or hot-water pastry, tempering, deboning), or many components that must come together at once. |

Classified as a Jev Choice (Score is not needed for three levels). The planner reads it as an ordinal: easy < medium < hard.

### Equipment (`equipment`): multi, may be empty

Question: "Does the recipe as written need X?" Only equipment beyond a hob, pans, knives, bowls and basic utensils counts. When the recipe offers alternatives ("in a slow cooker or a low oven"), tag only the first-named, primary route.

| Value | Label | Definition |
|---|---|---|
| `oven` | Oven | Uses the oven for any step. |
| `grill` | Grill | Uses an overhead grill. |
| `slow_cooker` | Slow cooker | Uses a slow cooker. |
| `pressure_cooker` | Pressure cooker | Uses a pressure cooker or electric multicooker under pressure. |
| `air_fryer` | Air fryer | Uses an air fryer. |
| `bbq` | Barbecue | Uses a barbecue or outdoor grill. |
| `microwave` | Microwave | Uses a microwave for a cooking step (not just to reheat). |
| `blender` | Blender | Uses a blender, stick blender or food processor. |
| `electric_mixer` | Electric mixer | Uses a stand mixer or hand-held electric whisk. |

`equipment:oven` and `method` are independent: a stew finished under the grill is `method:simmer` with `equipment:grill`. The most common use is the negative filter: "no oven" (`-equipment:oven`).

### Dietary (`diet`): multi, derived

Derived only, never classified. Each value names the ingredient property every counted line must carry.

| Value | Label | Definition (ingredient property required on every counted line) |
|---|---|---|
| `vegan` | Vegan | Contains no animal products, including honey. |
| `vegetarian` | Vegetarian | Contains no meat, poultry, fish, shellfish, gelatine or animal rennet. |
| `pescatarian` | Pescatarian | Contains no meat or poultry; fish and shellfish are allowed. |
| `gluten_free` | Gluten free | Contains no gluten-containing grain (wheat, barley, rye, spelt, standard oats) or ingredient made from one. |
| `dairy_free` | Dairy free | Contains no milk or milk-derived ingredient (butter, cheese, cream, whey). Eggs are allowed. |
| `egg_free` | Egg free | Contains no egg or egg-derived ingredient. |
| `nut_free` | Nut free | Contains no tree nuts or peanuts, or ingredients made from them. Coconut is allowed. |

Implied tags are stored, not inferred at query time: a vegan recipe also carries `vegetarian`, `pescatarian`, `dairy_free` and `egg_free`, so a filter on one value never needs taxonomy logic.

## What this asks of other tickets

- **Engine pipeline**: the tagging stage as above (Choices for single, Nouls for multi, meal-type fallback, protein gating, per-value thresholds in config), dietary derivation after ingredient resolution, and total time as a recipe-level number.
- **Knowledge base seeding**: the hierarchy must carry the properties in the dietary table and branches matching the protein values. Any property the seed lacks hides that `diet` value.
- **Data model**: tags as (dimension, value) with a source (engine, derived, correction) and the engine's confidence; user tags in the personal layer; the taxonomy version on each engine output.
- **Query model**: `dimension:value` for fixed tags, `tag:name` for user tags, a way to ask for unknown, and numeric `time`.
- **Suggestion scoring**: variety over `cuisine`, `protein`, `carb`, `method`; effort as a soft signal; unknown never counts as a match.
- **Golden set**: grade tags against these definitions, with the R02 and R03 expectations above.
